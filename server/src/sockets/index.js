const { Server } = require('socket.io');
const env = require('../config/env');
const { verifyToken } = require('../middleware/auth');
const { canAccessRoom } = require('../routes/rooms');
const Element = require('../models/Element');
const { OperationBuffer, validateOps } = require('../services/operationBuffer');

function createSocketHub(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
    transports: ['websocket'],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  });
  const buffer = new OperationBuffer();

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyToken(token);
      socket.user = { id: String(payload.sub), username: payload.username };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  async function roomUsers(roomId) {
    const sockets = await io.in(roomId).fetchSockets();
    const users = new Map();
    for (const peer of sockets) {
      const user = peer.data?.user || peer.user;
      if (user?.id) users.set(String(user.id), { userId: String(user.id), username: user.username || 'Collaborator' });
    }
    return [...users.values()];
  }

  async function publishPresence(roomId) {
    io.to(roomId).emit('presence', { users: await roomUsers(roomId) });
  }

  io.on('connection', (socket) => {
    socket.on('join-room', async ({ roomId } = {}, ack = () => {}) => {
      try {
        if (typeof roomId !== 'string' || roomId.length > 64) return ack({ ok: false, error: 'Invalid room' });
        const { session, allowed } = await canAccessRoom(roomId, socket.user.id);
        if (!session) return ack({ ok: false, error: 'Room not found' });
        if (!allowed) return ack({ ok: false, error: 'Private room' });

        if (socket.data.roomId && socket.data.roomId !== roomId) {
          const previous = socket.data.roomId;
          await socket.leave(previous);
          await publishPresence(previous);
        }
        await socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.user = socket.user;
        const elements = await Element.find({ roomId }).lean();
        const users = await roomUsers(roomId);
        io.to(roomId).emit('presence', { users });
        ack({ ok: true, elements, lamport: session.lamport || 0, users });
      } catch (err) {
        console.error('[socket] join-room failed:', err.message);
        ack({ ok: false, error: 'Unable to join room' });
      }
    });

    const acceptOps = (event, expectedType) => async (payload = {}, ack = () => {}) => {
      try {
        const roomId = socket.data.roomId;
        if (!roomId || payload.roomId !== roomId) return ack({ ok: false, error: 'Join the room first' });
        const ops = validateOps(payload.ops, expectedType).map((op) => ({ ...op, author: socket.user.id }));
        if (!buffer.enqueue(roomId, ops, socket.user.id)) {
          return ack({ ok: false, error: 'Server persistence queue is full; retry shortly' });
        }
        socket.to(roomId).emit('remote-ops', { ops });
        ack({ ok: true });
      } catch (err) {
        ack({ ok: false, error: err.message || 'Invalid operations' });
      }
    };

    socket.on('draw-stroke', acceptOps('draw-stroke', 'stroke'));
    socket.on('element-op', acceptOps('element-op'));

    socket.on('cursor', ({ roomId, x, y } = {}) => {
      if (roomId !== socket.data.roomId || !Number.isFinite(x) || !Number.isFinite(y)) return;
      socket.to(roomId).volatile.emit('cursor', {
        userId: socket.user.id,
        username: socket.user.username,
        x: Math.max(-1000000, Math.min(1000000, x)),
        y: Math.max(-1000000, Math.min(1000000, y)),
      });
    });

    socket.on('heartbeat', (ack = () => {}) => ack({ ok: true }));

    socket.on('disconnect', () => {
      if (socket.data.roomId) void publishPresence(socket.data.roomId).catch((err) => console.error('[socket] presence update failed:', err.message));
    });
  });

  return { io, buffer };
}

module.exports = { createSocketHub };

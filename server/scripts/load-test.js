/*
 * Custom Socket.IO load probe. Use distinct JWTs in TOKENS for distinct users.
 * Example (PowerShell):
 *   $env:BASE_URL='http://localhost:4000'; $env:ROOM_ID='abc123'; $env:TOKENS='jwt1,jwt2,...'
 *   $env:USERS='20'; $env:DURATION_SECONDS='30'; npm run load
 */
const { io } = require('socket.io-client');

const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
const roomId = process.env.ROOM_ID;
const tokens = (process.env.TOKENS || process.env.TOKEN || '').split(',').map((v) => v.trim()).filter(Boolean);
const users = Math.max(1, Math.min(100, Number(process.env.USERS) || tokens.length || 20));
const durationSeconds = Math.max(5, Number(process.env.DURATION_SECONDS) || 30);

if (!roomId || !tokens.length) {
  console.error('Set ROOM_ID and TOKEN (or comma-separated TOKENS) before running the load test.');
  process.exit(1);
}

const ackLatencies = [];
const deliveryLatencies = [];
const sockets = [];
const sentAt = new Map();
let sent = 0;
let acknowledged = 0;
let received = 0;
let failed = 0;

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(2));
};

function connectSocket(index) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, { auth: { token: tokens[index % tokens.length] }, transports: ['websocket'], reconnection: false, timeout: 10000 });
    const timer = setTimeout(() => reject(new Error(`Client ${index} connection timed out`)), 12000);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.timeout(10000).emit('join-room', { roomId }, (err, result) => {
        if (err || !result?.ok) return reject(new Error(`Client ${index} failed to join: ${result?.error || err?.message}`));
        socket.on('remote-ops', ({ ops = [] } = {}) => {
          for (const op of ops) {
            const started = sentAt.get(op.id);
            if (started) {
              deliveryLatencies.push(Date.now() - started);
              received += 1;
              sentAt.delete(op.id);
            }
          }
        });
        resolve(socket);
      });
    });
    socket.once('connect_error', (err) => { clearTimeout(timer); reject(err); });
  });
}

(async () => {
  try {
    for (let i = 0; i < users; i += 1) sockets.push(await connectSocket(i));
    console.log(`Connected ${sockets.length} clients to room ${roomId}; running ${durationSeconds}s.`);
    const stopAt = Date.now() + durationSeconds * 1000;
    let sequence = 0;
    while (Date.now() < stopAt) {
      await Promise.all(sockets.map((socket, index) => new Promise((resolve) => {
        const id = `load-${process.pid}-${index}-${sequence++}`;
        const started = Date.now();
        sentAt.set(id, started);
        const op = { id, type: 'rect', props: { x: sequence % 1000, y: index * 2, w: 40, h: 30, stroke: '#333333', strokeWidth: 2 }, clock: [Date.now() * 1000 + index, `load-client-${index}`] };
        socket.timeout(10000).emit('element-op', { roomId, ops: [op] }, (err, result) => {
          if (err || !result?.ok) failed += 1;
          else { acknowledged += 1; ackLatencies.push(Date.now() - started); }
          resolve();
        });
        sent += 1;
      })));
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(JSON.stringify({
      users: sockets.length, durationSeconds, sent, acknowledged, failed, peerDeliveries: received,
      ackMs: { avg: ackLatencies.length ? Number((ackLatencies.reduce((a, b) => a + b, 0) / ackLatencies.length).toFixed(2)) : null, p95: percentile(ackLatencies, 0.95) },
      peerDeliveryMs: { avg: deliveryLatencies.length ? Number((deliveryLatencies.reduce((a, b) => a + b, 0) / deliveryLatencies.length).toFixed(2)) : null, p95: percentile(deliveryLatencies, 0.95) },
    }, null, 2));
  } catch (err) {
    console.error('[load-test] failed:', err.message);
    process.exitCode = 1;
  } finally {
    sockets.forEach((socket) => socket.disconnect());
  }
})();

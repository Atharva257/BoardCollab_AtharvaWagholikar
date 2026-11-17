import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { Outbox } from '../lib/outbox';
import { transport } from '../lib/transport';
import { applyRemote, loadSnapshot } from '../store/canvasSlice';
import { setConnection, setCursor, setUsers } from '../store/presenceSlice';
import { logout } from '../store/authSlice';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;
const HEARTBEAT_MS = 30000;

export function useRoomSocket(roomId) {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth.token);

  useEffect(() => {
    if (!roomId || !token) return undefined;

    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 5000 });
    const outbox = new Outbox(socket, roomId);
    transport.attach(outbox);
    dispatch(setConnection('connecting'));

    const join = () => {
      socket.timeout(8000).emit('join-room', { roomId }, (err, res) => {
        if (err || !res?.ok) {
          dispatch(setConnection('offline'));
          return;
        }
        dispatch(loadSnapshot({ elements: res.elements, lamport: res.lamport }));
        dispatch(setUsers(res.users || []));
        dispatch(setConnection('online'));
        outbox.flush();
      });
    };

    socket.on('connect', join);
    socket.on('disconnect', () => dispatch(setConnection('offline')));
    // socket.on('connect_error', (e) => {
    //   dispatch(setConnection('offline'));
    //   if (e?.message === 'unauthorized') dispatch(logout());
    // });
    socket.on('connect_error', (e) => {
      console.error('[Socket.IO] Connection failed:', {
        message: e.message,
        description: e.description,
        context: e.context,
      });

      dispatch(setConnection('offline'));
      if (e?.message === 'unauthorized') dispatch(logout());
    });
    socket.on('remote-ops', ({ ops }) => dispatch(applyRemote(ops)));
    socket.on('presence', ({ users }) => dispatch(setUsers(users)));
    socket.on('cursor', (c) => dispatch(setCursor(c)));

    const heartbeat = setInterval(() => {
      if (!socket.connected) return;
      socket.timeout(10000).emit('heartbeat', (err) => dispatch(setConnection(err ? 'degraded' : 'online')));
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
      outbox.destroy();
      transport.detach(outbox);
      socket.disconnect();
    };
  }, [roomId, token, dispatch]);
}
import { compareClock } from './crdt';
import { loadPendingOps, removePendingOps, savePendingOps } from './outboxStore';

export const FLUSH_MS = 50;
const MAX_BATCH = 100;
const ACK_TIMEOUT_MS = 10000;
const CURSOR_MS = 50;
const opKey = (op) => `${op.id}:${op.clock?.[0] ?? 0}:${op.clock?.[1] ?? ''}`;

export function coalesce(ops) {
  const latest = new Map();
  for (const op of ops) {
    for (const [key, value] of Object.entries(op.props)) {
      const k = `${op.id}|${key}`;
      const prev = latest.get(k);
      if (!prev || compareClock(op.clock, prev.op.clock) > 0) latest.set(k, { op, key, value });
    }
  }
  const groups = new Map();
  for (const { op, key, value } of latest.values()) {
    const gk = `${op.id}|${op.clock[0]}|${op.clock[1]}`;
    let g = groups.get(gk);
    if (!g) {
      g = { id: op.id, type: op.type, author: op.author, clock: op.clock, props: {} };
      groups.set(gk, g);
    }
    g.props[key] = value;
  }
  return [...groups.values()];
}

export class Outbox {
  constructor(socket, roomId) {
    this.socket = socket;
    this.roomId = roomId;
    this.queue = [];
    this.timer = null;
    this.lastCursor = 0;
    this.destroyed = false;
    this.persistChain = Promise.resolve();
    this.ready = loadPendingOps(roomId).then((saved) => {
      const present = new Set(this.queue.map(opKey));
      for (const op of saved) if (!present.has(opKey(op))) this.queue.push(op);
    }).catch((err) => console.warn('[outbox] could not restore offline operations:', err));
  }

  push(ops) {
    if (!ops?.length) return;
    const known = new Set(this.queue.map(opKey));
    const added = ops.filter((op) => !known.has(opKey(op)));
    this.queue.push(...added);
    this.persistChain = this.persistChain.then(() => savePendingOps(this.roomId, added)).catch((err) => console.warn('[outbox] offline persistence failed:', err));
    this.schedule();
  }

  schedule() {
    if (this.timer || this.destroyed) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_MS);
  }

  async flush() {
    await this.ready;
    await this.persistChain;
    if (this.destroyed || !this.socket.connected || !this.queue.length) return;
    const rawBatch = this.queue.splice(0, this.queue.length);
    const batch = coalesce(rawBatch);
    const strokes = batch.filter((o) => o.type === 'stroke');
    const elements = batch.filter((o) => o.type !== 'stroke');
    this.send('draw-stroke', strokes, rawBatch.filter((o) => o.type === 'stroke'));
    this.send('element-op', elements, rawBatch.filter((o) => o.type !== 'stroke'));
  }

  send(event, ops, persistedOps = ops) {
    for (let i = 0; i < ops.length; i += MAX_BATCH) {
      const chunk = ops.slice(i, i + MAX_BATCH);
      const ids = new Set(chunk.map((op) => op.id));
      const persistedChunk = persistedOps.filter((op) => ids.has(op.id));
      this.socket.timeout(ACK_TIMEOUT_MS).emit(event, { roomId: this.roomId, ops: chunk }, (err, res) => {
        if (err) {
          this.queue.unshift(...persistedChunk);
          if (this.socket.connected) this.schedule();
        } else if (res?.ok === false) {
          console.warn(`[outbox] ${event} rejected:`, res.error);
          // Preserve the original queued operations so retry/coalescing remains lossless.
          this.queue.unshift(...persistedChunk);
          if (String(res.error || '').toLowerCase().includes('queue is full')) this.schedule();
        } else {
          this.persistChain = this.persistChain.then(() => removePendingOps(this.roomId, persistedChunk)).catch((e) => console.warn('[outbox] could not clear acknowledged operations:', e));
        }
      });
    }
  }

  cursor(x, y) {
    const now = Date.now();
    if (now - this.lastCursor < CURSOR_MS || !this.socket.connected) return;
    this.lastCursor = now;
    this.socket.volatile.emit('cursor', { roomId: this.roomId, x, y });
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

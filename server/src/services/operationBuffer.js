const Session = require('../models/Session');
const Element = require('../models/Element');

const ALLOWED_PROPS = {
  stroke: new Set(['x', 'y', 'points', 'stroke', 'strokeWidth', 'deleted']),
  rect: new Set(['x', 'y', 'w', 'h', 'stroke', 'strokeWidth', 'deleted']),
  circle: new Set(['x', 'y', 'rx', 'ry', 'stroke', 'strokeWidth', 'deleted']),
  text: new Set(['x', 'y', 'text', 'fontSize', 'fill', 'deleted']),
};

function validateOps(ops, expectedType) {
  if (!Array.isArray(ops) || ops.length < 1 || ops.length > 100) {
    throw new Error('A batch must contain between 1 and 100 operations');
  }

  return ops.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid operation');
    const { id, type, props, clock } = raw;
    if (typeof id !== 'string' || id.length < 1 || id.length > 128) throw new Error('Invalid element id');
    if (!ALLOWED_PROPS[type] || (expectedType && type !== expectedType)) throw new Error('Invalid element type');
    if (!props || typeof props !== 'object' || Array.isArray(props)) throw new Error('Invalid operation properties');
    const keys = Object.keys(props);
    if (!keys.length || keys.some((key) => !ALLOWED_PROPS[type].has(key))) throw new Error('Unsupported element property');
    if (!Array.isArray(clock) || clock.length !== 2 || !Number.isSafeInteger(clock[0]) || clock[0] < 1 ||
        typeof clock[1] !== 'string' || clock[1].length < 1 || clock[1].length > 100) {
      throw new Error('Invalid operation clock');
    }
    if (props.points !== undefined && (!Array.isArray(props.points) || props.points.length > 20000 || props.points.some((n) => !Number.isFinite(n)))) {
      throw new Error('Invalid stroke points');
    }
    for (const key of ['x', 'y', 'w', 'h', 'rx', 'ry', 'strokeWidth', 'fontSize']) {
      if (props[key] !== undefined && (!Number.isFinite(props[key]) || Math.abs(props[key]) > 1000000)) {
        throw new Error(`Invalid ${key}`);
      }
    }
    for (const key of ['stroke', 'fill', 'text']) {
      if (props[key] !== undefined && (typeof props[key] !== 'string' || props[key].length > (key === 'text' ? 10000 : 100))) {
        throw new Error(`Invalid ${key}`);
      }
    }
    if (props.deleted !== undefined && typeof props.deleted !== 'boolean') throw new Error('Invalid deleted flag');
    return { id, type, props, clock, author: undefined };
  });
}

// Values from clients are wrapped in $literal because strings such as "$foo"
// must be stored as text, not interpreted as aggregation field references.
function makePipelineUpdate(roomId, op, userId) {
  const clock = op.clock;
  const set = {
    roomId: { $ifNull: ['$roomId', { $literal: roomId }] },
    elementId: { $ifNull: ['$elementId', { $literal: op.id }] },
    type: { $ifNull: ['$type', { $literal: op.type }] },
    author: { $ifNull: ['$author', { $literal: userId }] },
    created: {
      $cond: [
        { $or: [
          { $eq: [{ $type: '$created' }, 'missing'] },
          { $gt: [{ $ifNull: ['$created', { $literal: clock }] }, { $literal: clock }] },
        ] },
        { $literal: clock },
        '$created',
      ],
    },
    lamport: { $max: [{ $ifNull: ['$lamport', 0] }, clock[0]] },
    clientId: {
      $cond: [
        { $gt: [{ $literal: clock }, [{ $ifNull: ['$lamport', -1] }, { $ifNull: ['$clientId', ''] }]] },
        { $literal: clock[1] },
        { $ifNull: ['$clientId', { $literal: clock[1] }] },
      ],
    },
    updatedAt: '$$NOW',
  };

  for (const [key, value] of Object.entries(op.props)) {
    const clockPath = `$clocks.${key}`;
    const isNewer = { $gt: [{ $literal: clock }, { $ifNull: [clockPath, [-1, '']] }] };
    const valuePath = key === 'deleted' ? '$deleted' : `$data.${key}`;
    const setPath = key === 'deleted' ? 'deleted' : `data.${key}`;
    set[setPath] = { $cond: [isNewer, { $literal: value }, { $ifNull: [valuePath, null] }] };
    set[`clocks.${key}`] = { $cond: [isNewer, { $literal: clock }, { $ifNull: [clockPath, null] }] };
  }

  return {
    updateOne: {
      filter: { roomId, elementId: op.id },
      update: [{ $set: set }],
      upsert: true,
    },
  };
}

class OperationBuffer {
  constructor({ intervalMs = 5000, maxBatch = 100, maxPending = 50000 } = {}) {
    this.intervalMs = intervalMs;
    this.maxBatch = maxBatch;
    this.maxPending = maxPending;
    this.queue = [];
    this.timer = null;
    this.flushing = null;
    this.closed = false;
  }

  enqueue(roomId, ops, userId) {
    if (this.closed || this.queue.length + ops.length > this.maxPending) return false;
    for (const op of ops) this.queue.push({ roomId, op, userId });
    if (this.queue.length >= this.maxBatch) void this.flush();
    else this.schedule();
    return true;
  }

  schedule() {
    if (this.timer || this.closed) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  async flush() {
    if (this.flushing) return this.flushing;
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.maxBatch);
    this.flushing = (async () => {
      try {
        // Preserve operation order within a batch. The update pipeline performs
        // each property comparison atomically inside MongoDB.
        const writes = batch.map(({ roomId, op, userId }) => makePipelineUpdate(roomId, op, userId));
        await Element.bulkWrite(writes, { ordered: true });
        const roomMax = new Map();
        for (const item of batch) {
          roomMax.set(item.roomId, Math.max(roomMax.get(item.roomId) || 0, item.op.clock[0]));
        }
        await Promise.all([...roomMax].map(([roomId, lamport]) =>
          Session.updateOne({ roomId }, { $max: { lamport }, $set: { lastUpdated: new Date() } })
        ));
      } catch (err) {
        this.queue.unshift(...batch);
        console.error('[operation-buffer] persistence failed; batch will be retried:', err.message);
      } finally {
        this.flushing = null;
        if (this.queue.length) this.schedule();
      }
    })();
    return this.flushing;
  }

  async close() {
    this.closed = true;
    clearTimeout(this.timer);
    this.timer = null;
    let attempts = 0;
    while ((this.queue.length || this.flushing) && attempts < 3) {
      if (this.flushing) await this.flushing;
      else await this.flush();
      attempts += 1;
      if (this.queue.length && !this.flushing) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (this.queue.length) console.error(`[operation-buffer] shutdown with ${this.queue.length} unpersisted operations`);
  }
}

module.exports = { OperationBuffer, validateOps };

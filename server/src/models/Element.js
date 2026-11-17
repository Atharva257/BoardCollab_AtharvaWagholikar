const { Schema, model } = require('mongoose');

/**
 * One canvas element (stroke / rect / circle / text) = one LWW-register.
 * Merge rule: higher (lamport, clientId) wins, applied per element.
 * Deletes are tombstones (deleted: true) so late-arriving edits cannot
 * resurrect a removed element.
 *
 * Shard key: { roomId: 'hashed' }
 */
const ElementSchema = new Schema({
  roomId: { type: String, required: true },
  elementId: { type: String, required: true },
  type: { type: String, enum: ['stroke', 'rect', 'circle', 'text'], required: true },
  data: { type: Object, default: {} },
  author: { type: String }, // userId of creator
  lamport: { type: Number, required: true }, // highest clock seen on this element
  created: { type: [Schema.Types.Mixed], default: undefined }, // [lamport, clientId] of earliest op: fixes z-order
  clocks: { type: Object, default: {} }, // per-property [lamport, clientId] for exact LWW merge
  clientId: { type: String, required: true },
  deleted: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

ElementSchema.index({ roomId: 1, elementId: 1 }, { unique: true });

module.exports = model('Element', ElementSchema);

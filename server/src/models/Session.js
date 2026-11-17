const { Schema, model } = require('mongoose');

/**
 * Session = room metadata only. Elements live in the `elements` collection
 * (see Element.js) so a room is not bounded by the 16MB document limit and
 * high-frequency writes do not contend on a single document.
 *
 * Shard key: { roomId: 'hashed' }
 */
const SessionSchema = new Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  joinCode: { type: String, select: false }, // only set for private rooms
  users: [
    {
      _id: false,
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      joinedAt: { type: Date, default: Date.now },
    },
  ],
  elementCount: { type: Number, default: 0 },
  lamport: { type: Number, default: 0 }, // highest logical clock persisted
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = model('Session', SessionSchema);

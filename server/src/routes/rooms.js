const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');
const Session = require('../models/Session');
const Element = require('../models/Element');
const { requireAuth } = require('../middleware/auth');

const createSchema = z.object({
  name: z.string().min(1).max(80),
  visibility: z.enum(['public', 'private']).default('public'),
});
const joinSchema = z.object({ joinCode: z.string().optional() });

const isMember = (session, userId) =>
  String(session.owner) === userId || session.users.some((u) => String(u.userId) === userId);

// Reused by the Socket.IO join-room handler in Step 2.
async function canAccessRoom(roomId, userId) {
  const session = await Session.findOne({ roomId });
  if (!session) return { session: null, allowed: false };
  const allowed = session.visibility === 'public' || isMember(session, userId);
  return { session, allowed };
}

// POST /api/rooms  -> create room
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, visibility } = createSchema.parse(req.body);
    const session = await Session.create({
      roomId: crypto.randomBytes(6).toString('hex'),
      name,
      visibility,
      owner: req.user.id,
      joinCode: visibility === 'private' ? crypto.randomBytes(4).toString('hex') : undefined,
      users: [{ userId: req.user.id }],
    });
    res.status(201).json({
      roomId: session.roomId,
      name: session.name,
      visibility: session.visibility,
      joinCode: session.joinCode, // returned once, to the owner only
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms/:id/join  -> become a member (private rooms need joinCode)
router.post('/:id/join', requireAuth, async (req, res, next) => {
  try {
    const { joinCode } = joinSchema.parse(req.body);
    const session = await Session.findOne({ roomId: req.params.id }).select('+joinCode');
    if (!session) return res.status(404).json({ error: 'Room not found' });
    if (session.visibility === 'private' && !isMember(session, req.user.id)) {
      if (!joinCode || joinCode !== session.joinCode) {
        return res.status(403).json({ error: 'Invalid join code' });
      }
    }
    if (!isMember(session, req.user.id)) {
      session.users.push({ userId: req.user.id });
      await session.save();
    }
    res.json({ roomId: session.roomId, name: session.name });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:id  -> fetch session + elements (tombstones included so cached/offline clients converge)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { session, allowed } = await canAccessRoom(req.params.id, req.user.id);
    if (!session) return res.status(404).json({ error: 'Room not found' });
    if (!allowed) return res.status(403).json({ error: 'Private room' });
    const elements = await Element.find({ roomId: session.roomId }).lean();
    res.json({
      roomId: session.roomId,
      name: session.name,
      visibility: session.visibility,
      owner: session.owner,
      lamport: session.lamport,
      elements,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, canAccessRoom };

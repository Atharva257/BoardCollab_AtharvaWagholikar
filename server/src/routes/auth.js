const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

const registerSchema = z.object({
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, passwordHash });
    res.status(201).json({
      token: signToken(user),
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({
      token: signToken(user),
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

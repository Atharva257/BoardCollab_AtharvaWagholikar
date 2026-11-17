const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), username: user.username }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

// Shared with the Socket.IO handshake in Step 2.
function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, verifyToken, requireAuth };

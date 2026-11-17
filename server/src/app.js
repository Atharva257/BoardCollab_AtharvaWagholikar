const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const authRoutes = require('./routes/auth');
const { router: roomRoutes } = require('./routes/rooms');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authRoutes);
  app.use('/api/rooms', roomRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

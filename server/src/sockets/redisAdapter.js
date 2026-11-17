const env = require('../config/env');

async function configureRedisAdapter(io) {
  if (!env.redisUrl) {
    console.warn('[redis] REDIS_URL is empty; Socket.IO is running in single-instance mode.');
    return null;
  }

  let pubClient;
  let subClient;
  try {
    const { createClient } = require('redis');
    const { createAdapter } = require('@socket.io/redis-adapter');
    pubClient = createClient({ url: env.redisUrl, socket: { connectTimeout: 3000, reconnectStrategy: (retries) => retries > 2 ? new Error('Redis unavailable') : Math.min(retries * 250, 1000) } });
    subClient = pubClient.duplicate();
    pubClient.on('error', (err) => console.error('[redis] publisher error:', err.message));
    subClient.on('error', (err) => console.error('[redis] subscriber error:', err.message));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[redis] Socket.IO Redis adapter enabled.');
    return async () => {
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
    };
  } catch (err) {
    await Promise.allSettled([pubClient?.quit?.(), subClient?.quit?.()]);
    if (env.nodeEnv === 'production' && process.env.REDIS_REQUIRED === 'true') throw err;
    console.warn('[redis] Adapter unavailable; falling back to single-instance mode:', err.message);
    return null;
  }
}

module.exports = { configureRedisAdapter };

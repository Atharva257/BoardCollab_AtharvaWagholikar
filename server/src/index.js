const http = require('http');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { createSocketHub } = require('./sockets');
const { configureRedisAdapter } = require('./sockets/redisAdapter');

async function main() {
  await connectDB();
  const server = http.createServer(createApp());
  const { io, buffer } = createSocketHub(server);
  const closeRedis = await configureRedisAdapter(io);

  server.listen(env.port, () => console.log(`BoardCollab API + Socket.IO on :${env.port}`));

  const shutdown = async (signal) => {
    console.log(`${signal} received; closing BoardCollab...`);
    await buffer.close();
    await new Promise((resolve) => io.close(resolve));
    await closeRedis?.();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

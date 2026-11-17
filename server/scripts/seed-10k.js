const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const Session = require('../src/models/Session');
const Element = require('../src/models/Element');

async function main() {
  await connectDB();
  const roomId = process.env.ROOM_ID || `load-10k-${Date.now()}`;
  const owner = new mongoose.Types.ObjectId();
  await Session.create({ roomId, name: '10k element performance board', owner, visibility: 'public', users: [], lamport: 10000 });

  const docs = Array.from({ length: 10000 }, (_, index) => {
    const clock = [index + 1, 'seed-client'];
    return {
      roomId,
      elementId: `seed-rect-${index + 1}`,
      type: 'rect',
      data: { x: (index % 100) * 140, y: Math.floor(index / 100) * 100, w: 100, h: 60, stroke: '#64748b', strokeWidth: 2 },
      author: String(owner),
      lamport: index + 1,
      clientId: 'seed-client',
      created: clock,
      clocks: { x: clock, y: clock, w: clock, h: clock, stroke: clock, strokeWidth: clock },
      deleted: false,
    };
  });
  await Element.insertMany(docs, { ordered: false });
  console.log(`Seeded ${docs.length} elements. Room id: ${roomId}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed-10k] failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});

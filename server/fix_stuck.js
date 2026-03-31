import { MongoClient } from 'mongodb';

async function run() {
  const c = new MongoClient('mongodb://localhost:27017');
  await c.connect();
  const db = c.db('ridemate');
  const res = await db.collection('rides').updateMany(
    { status: 'locked' },
    { $set: { status: 'pickup_started' } }
  );
  console.log('Fixed stuck rides:', res.modifiedCount);
  await c.close();
}
run();

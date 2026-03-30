import { MongoClient } from 'mongodb';

async function run() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('ridemate');
    
    const activeStatuses = ['waiting', 'confirmed', 'locked', 'pickup_started', 'ongoing'];
    
    // 1. Mark all active rides as completed
    const rideRes = await db.collection('rides').updateMany(
      { status: { $in: activeStatuses } },
      { $set: { status: 'completed' } }
    );
    console.log(`Updated ${rideRes.modifiedCount} rides to completed.`);
    
    // 2. Clear activeRideId for all users
    const userRes = await db.collection('users').updateMany(
      {},
      { $set: { activeRideId: null } }
    );
    console.log(`Cleared activeRideId for ${userRes.modifiedCount} users.`);

  } catch (err) {
    console.error('Error running cleanup:', err);
  } finally {
    await client.close();
  }
}

run();

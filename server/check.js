import { MongoClient } from 'mongodb';

async function run() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('ridemate');
    
    // Find ALL rides that are not completed and not cancelled
    const rides = await db.collection('rides').find({ status: { $nin: ['completed', 'cancelled'] } }).toArray();
    console.log('Active Rides count:', rides.length);
    rides.forEach(r => console.log(`Ride ${r._id} status: ${r.status}`));

    // Hard forcefully update ALL
    const rideRes = await db.collection('rides').updateMany(
      { status: { $nin: ['completed', 'cancelled'] } },
      { $set: { status: 'completed' } }
    );
    console.log(`Updated ${rideRes.modifiedCount} rides to completed.`);

    const userRes = await db.collection('users').updateMany(
      { activeRideId: { $ne: null } },
      { $set: { activeRideId: null } }
    );
    console.log(`Cleared activeRideId for ${userRes.modifiedCount} users.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();

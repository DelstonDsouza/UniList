const mongoose = require('mongoose');

// Mongoose Schemas (Simplified for migration)
const RideSchema = new mongoose.Schema({
  riderId: mongoose.Schema.Types.ObjectId,
  status: String,
  passenger: { userId: mongoose.Schema.Types.ObjectId }
});

const UserSchema = new mongoose.Schema({
  isRider: Boolean,
  activeRideId: mongoose.Schema.Types.ObjectId
});

const Ride = mongoose.model('Ride', RideSchema);
const User = mongoose.model('User', UserSchema);

async function clear() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ridemate');
    console.log('Connected to MongoDB');

    const uid = '69a93a5badebffcb1471557a';
    
    // Clear rider rides
    const res1 = await Ride.updateMany(
      { riderId: uid, status: { $in: ['pending', 'locked', 'pickup_started', 'ongoing', 'arrived'] } },
      { $set: { status: 'cancelled' } }
    );
    console.log(`Cancelled ${res1.modifiedCount} rider rides.`);

    // Clear passenger rides
    const res2 = await Ride.updateMany(
      { 'passenger.userId': uid, status: { $in: ['pending', 'locked', 'pickup_started', 'ongoing', 'arrived'] } },
      { $set: { status: 'cancelled' } }
    );
    console.log(`Cancelled ${res2.modifiedCount} passenger rides.`);

    // Clear user activeRideId
    await User.findByIdAndUpdate(uid, { $set: { activeRideId: null } });
    console.log('Cleared user activeRideId');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clear();

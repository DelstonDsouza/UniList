import mongoose from "mongoose"

const rideSchema = new mongoose.Schema({
    id: String,
    riderUid: String,
    riderName: String,
    currentLat: Number,
    currentLng: Number,
    pickupLat: Number,
    pickupLng: Number,
    destination: String,
    departureTime: String,
    pickupLater: Boolean,
    passengerUid: String,
    passengerName: String,
    passengerPhone: String,
    passengerLat: Number,
    passengerLng: Number,
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: () => new Date() },
})

const Ride = mongoose.model("Ride", rideSchema)

export default Ride

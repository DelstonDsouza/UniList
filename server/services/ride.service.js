// server/services/ride.service.js

import mongoose from "mongoose"
import Ride from "../models/Ride.js"
import User from "../models/User.js"
import College from "../models/College.js"
import { calculateFare } from "./fare.service.js"
import { io } from "../index.js"

const RADIUS_METERS = 3000

// St Aloysius College, Mangalore — fallback destination
const DEFAULT_COLLEGE_LAT = 12.8698
const DEFAULT_COLLEGE_LNG = 74.8425

const isValidId = (id) => id && mongoose.Types.ObjectId.isValid(id)

// ─────────────────────────────────────────────────────────────
// Get pending rides within 3 km of passenger
// ─────────────────────────────────────────────────────────────
export async function getNearbyRides(passengerLat, passengerLng, collegeId) {
  if (!passengerLat || !passengerLng || passengerLat === 0 || passengerLng === 0) {
    const err = new Error("Valid GPS coordinates required")
    err.code = "INVALID_LOCATION"
    err.status = 400
    throw err
  }

  const query = {
    status: "pending",
    currentLocation: {
      $nearSphere: {
        $geometry: {
          type: "Point",
          coordinates: [passengerLng, passengerLat],
        },
        $maxDistance: RADIUS_METERS,
      },
    },
  }

  if (isValidId(collegeId)) query.collegeId = collegeId

  const rides = await Ride.find(query)
    .select("-__v")   // return everything except __v (keep fare, passenger visible to rider)
    .lean()

  return rides
}

// ─────────────────────────────────────────────────────────────
// Lock a ride atomically
// ─────────────────────────────────────────────────────────────
export async function lockRide(rideId, passenger, collegeId) {
  const passengerUser = await User.findById(passenger.userId)
  if (!passengerUser) {
    const err = new Error("User not found")
    err.code = "USER_NOT_FOUND"; err.status = 404; throw err
  }
  if (passengerUser.activeRideId) {
    const err = new Error("You already have an active ride. Complete it first.")
    err.code = "ACTIVE_RIDE_EXISTS"; err.status = 400; throw err
  }

  if (!passenger.lat || !passenger.lng || passenger.lat === 0) {
    const err = new Error("Valid GPS coordinates required")
    err.code = "INVALID_LOCATION"; err.status = 400; throw err
  }

  // Try to get college coordinates, fall back to St Aloysius
  let collegeLat = DEFAULT_COLLEGE_LAT
  let collegeLng = DEFAULT_COLLEGE_LNG

  if (isValidId(collegeId)) {
    try {
      const college = await College.findById(collegeId)
      if (college?.location?.coordinates) {
        collegeLat = college.location.coordinates[1]
        collegeLng = college.location.coordinates[0]
      }
    } catch { /* use default */ }
  }

  const { distanceKm, amount } = calculateFare(
    passenger.lat, passenger.lng,
    collegeLat, collegeLng
  )

  console.log(`Fare calc: passenger(${passenger.lat},${passenger.lng}) → college(${collegeLat},${collegeLng}) = ${distanceKm}km ₹${amount}`)

  const lockQuery = { _id: rideId, status: "pending" }
  if (isValidId(collegeId)) lockQuery.collegeId = collegeId

  const ride = await Ride.findOneAndUpdate(
    lockQuery,
    {
      $set: {
        status: "locked",
        lockedAt: new Date(),
        passenger: {
          userId: passenger.userId,
          name:   passenger.name,
          phone:  passenger.phone,
          location: {
            type: "Point",
            coordinates: [passenger.lng, passenger.lat],
          },
        },
        fare: {
          distanceKm,
          amount,
          calculatedAt: new Date(),
        },
      },
    },
    { new: true, runValidators: true }
  )

  if (!ride) {
    const err = new Error("This ride was just taken by someone else. Please choose another rider.")
    err.code = "RIDE_ALREADY_TAKEN"; err.status = 409; throw err
  }

  await User.findByIdAndUpdate(passenger.userId, {
    $set: { activeRideId: ride._id },
  })

  // Notify all passengers watching — remove this ride from their list
  io.to("riders-watch").emit("ride:locked", { rideId: String(ride._id) })

  // Notify rider instantly via Socket.io — no polling needed
  io.to(`ride:${ride._id}`).emit("ride:locked", {
    rideId:         String(ride._id),
    passengerName:  ride.passenger.name,
    passengerPhone: ride.passenger.phone,
    passengerLat:   passenger.lat,
    passengerLng:   passenger.lng,
    fare:           ride.fare.amount,
    distanceKm:     ride.fare.distanceKm,
  })

  return ride
}

// ─────────────────────────────────────────────────────────────
// LOCKED → ONGOING
// ─────────────────────────────────────────────────────────────
export async function startRide(rideId, riderId) {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, riderId, status: "locked" },
    { $set: { status: "ongoing", startedAt: new Date() } },
    { new: true }
  )
  if (!ride) {
    const err = new Error("Ride cannot be started — must be in locked state")
    err.code = "INVALID_TRANSITION"; err.status = 400; throw err
  }
  return ride
}

// ─────────────────────────────────────────────────────────────
// ONGOING → COMPLETED
// ─────────────────────────────────────────────────────────────
export async function completeRide(rideId, riderId, paymentMethod) {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, riderId, status: "ongoing" },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        "payment.method": paymentMethod || "cash",
        "payment.status": "paid",
      },
    },
    { new: true }
  )
  if (!ride) {
    const err = new Error("Ride cannot be completed — must be in ongoing state")
    err.code = "INVALID_TRANSITION"; err.status = 400; throw err
  }

  if (ride.passenger?.userId) {
    await User.findByIdAndUpdate(ride.passenger.userId, {
      $set: { activeRideId: null },
    })
  }
  return ride
}

// ─────────────────────────────────────────────────────────────
// Rider rejects locked passenger
// ─────────────────────────────────────────────────────────────
export async function rejectPassenger(rideId, riderId) {
  const existing = await Ride.findOne({ _id: rideId, riderId, status: "locked" })
  if (!existing) {
    const err = new Error("Cannot reject — ride not in locked state")
    err.code = "INVALID_TRANSITION"; err.status = 400; throw err
  }

  const passengerId = existing.passenger?.userId

  const ride = await Ride.findByIdAndUpdate(
    rideId,
    {
      $set: {
        status: "pending",
        lockedAt: null,
        passenger: null,
        fare: null,
      },
    },
    { new: true }
  )

  if (passengerId) {
    await User.findByIdAndUpdate(passengerId, { $set: { activeRideId: null } })
  }
  return ride
}

// ─────────────────────────────────────────────────────────────
// Get passenger's current active ride
// ─────────────────────────────────────────────────────────────
export async function getPassengerActiveRide(userId) {
  const user = await User.findById(userId).select("activeRideId")
  if (!user?.activeRideId) return null
  return Ride.findById(user.activeRideId).lean()
}
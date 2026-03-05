// server/services/ride.service.js

import Ride from "../models/Ride.js"
import {
  COLLEGE,
  calculateFare,
  isValidCoord,
  haversineKm,
  fetchOSRMRoute,
  nearestPointOnRoute,
  reverseGeocode,
} from "../utils/geo.js"

function httpError(message, status = 400) {
  const err = new Error(message)
  err.status = status
  return err
}

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

async function getPickupInfo(ride, passengerLat, passengerLng) {
  const riderLat = ride.currentLocation?.coordinates?.[1]
  const riderLng = ride.currentLocation?.coordinates?.[0]
  if (!riderLat || !riderLng) return null

  const directDistToRider = haversineKm(riderLat, riderLng, passengerLat, passengerLng)
  if (directDistToRider > 10) return null

  const routePoints = await fetchOSRMRoute(riderLat, riderLng, COLLEGE.lat, COLLEGE.lng)

  if (!routePoints) {
    if (directDistToRider > 2) return null
    const { km, fare } = calculateFare(passengerLat, passengerLng)
    return {
      distanceKm: km, fareAmount: fare, distToRoute: 0,
      pickupLat: passengerLat, pickupLng: passengerLng,
      needsToWalkToRoute: false, nearestRouteLat: null, nearestRouteLng: null,
      osrmAvailable: false,
    }
  }

  const { nearestLat, nearestLng, distanceKm: distToRoute } =
    nearestPointOnRoute(routePoints, passengerLat, passengerLng)

  if (distToRoute > 2) return null

  const riderToCollege   = haversineKm(riderLat, riderLng, COLLEGE.lat, COLLEGE.lng)
  const nearestToCollege = haversineKm(nearestLat, nearestLng, COLLEGE.lat, COLLEGE.lng)
  if (nearestToCollege > riderToCollege + 0.1) return null

  const { km, fare } = calculateFare(passengerLat, passengerLng)

  if (distToRoute <= 1) {
    return {
      distanceKm: km, fareAmount: fare,
      distToRoute: Number(distToRoute.toFixed(3)),
      pickupLat: passengerLat, pickupLng: passengerLng,
      needsToWalkToRoute: false, nearestRouteLat: null, nearestRouteLng: null,
      osrmAvailable: true,
    }
  } else {
    return {
      distanceKm: km, fareAmount: fare,
      distToRoute: Number(distToRoute.toFixed(3)),
      pickupLat: nearestLat, pickupLng: nearestLng,
      needsToWalkToRoute: true,
      nearestRouteLat: nearestLat, nearestRouteLng: nearestLng,
      passengerActualLat: passengerLat, passengerActualLng: passengerLng,
      osrmAvailable: true,
    }
  }
}

// ── GET NEARBY RIDES ──────────────────────────────────────────────────────────
export async function getNearbyRides(passengerLat, passengerLng) {
  if (!isValidCoord(passengerLat, passengerLng))
    throw httpError("Invalid passenger coordinates.")

  const allPending = await Ride.find({ status: "pending" }).lean()

  const results = await Promise.all(
    allPending.map(async (ride) => {
      const pickupInfo = await getPickupInfo(ride, passengerLat, passengerLng)
      if (!pickupInfo) return null
      const riderLat     = ride.currentLocation?.coordinates?.[1]
      const riderLng     = ride.currentLocation?.coordinates?.[0]
      const locationName = await reverseGeocode(riderLat, riderLng)
      return { ...ride, locationName, ...pickupInfo }
    })
  )

  return results.filter(Boolean).sort((a, b) => a.distToRoute - b.distToRoute)
}

// ── LOCK RIDE ─────────────────────────────────────────────────────────────────
export async function lockRide(rideId, { userId, name, phone, lat, lng }) {
  const ride = await Ride.findById(rideId)
  if (!ride)                     throw httpError("Ride not found.", 404)
  if (ride.status !== "pending") throw httpError("Ride no longer available.", 409)

  const pickupInfo = await getPickupInfo(ride, lat, lng)
  if (!pickupInfo) throw httpError("You are not on this rider's route.", 400)

  const { km, fare } = calculateFare(lat, lng)
  const otp = generateOTP()

  ride.passenger = {
    userId, name, phone,
    location: { type: "Point", coordinates: [lng, lat] },
  }
  ride.fare     = { distanceKm: km, amount: fare, calculatedAt: new Date() }
  ride.otp      = otp
  ride.status   = "locked"
  ride.lockedAt = new Date()
  await ride.save()
  return ride
}

// ── START RIDE ────────────────────────────────────────────────────────────────
// Accepts both "locked" and "pickup_started" — rider may click start from either state
export async function startRide(rideId, riderId) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride) throw httpError("Ride not found.", 404)
  if (!["locked", "pickup_started"].includes(ride.status))
    throw httpError("Ride must be locked or pickup_started before starting.", 400)
  ride.status    = "ongoing"
  ride.startedAt = new Date()
  await ride.save()
  return ride
}

// ── COMPLETE RIDE ─────────────────────────────────────────────────────────────
export async function completeRide(rideId, riderId, paymentMethod) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride)                     throw httpError("Ride not found.", 404)
  if (ride.status !== "ongoing") throw httpError("Ride must be ongoing to complete.", 400)
  ride.status         = "completed"
  ride.completedAt    = new Date()
  ride.payment.method = paymentMethod || "cash"
  ride.payment.status = "paid"
  await ride.save()
  return ride
}

// ── REJECT PASSENGER ──────────────────────────────────────────────────────────
export async function rejectPassenger(rideId, riderId) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride) throw httpError("Ride not found.", 404)
  ride.passenger = null
  ride.fare      = null
  ride.otp       = null
  ride.status    = "pending"
  ride.lockedAt  = null
  await ride.save()
  return ride
}

// ── GET PASSENGER ACTIVE RIDE ─────────────────────────────────────────────────
export async function getPassengerActiveRide(userId) {
  return Ride.findOne({
    "passenger.userId": userId,
    status: { $in: ["locked", "pickup_started", "ongoing"] },
  }).lean()
}

// ── GET RIDER HISTORY ─────────────────────────────────────────────────────────
export async function getRiderHistory(riderId, limit = 20) {
  return Ride.find({ riderId }).sort({ createdAt: -1 }).limit(limit).lean()
}
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

// ── ROUTE ELIGIBILITY + PICKUP POINT ─────────────────────────────────────────
//
// Rules:
//  1. Same-route visibility limit: 2 km
//     - Fetch the rider's route (riderLocation → college).
//     - Find the nearest point on that route to the passenger.
//     - If the passenger is >2 km from the route → not eligible (don't show ride).
//     - The nearest route point must be AHEAD of the rider (not behind), so the
//       rider never has to go in the opposite direction of the college.
//
//  2. Pickup threshold: 1 km
//     - If passenger is ≤1 km from the route → pick up at their exact location.
//     - If passenger is 1–2 km from the route → show the ride, but set pickup
//       point to the nearest main-road point. Flag needsToWalkToRoute = true so
//       the frontend can draw a red path from passenger → nearest route point.
//     - If passenger is >2 km from the route → not eligible (filtered above).
//
async function getPickupInfo(ride, passengerLat, passengerLng) {
  const riderLat = ride.currentLocation?.coordinates?.[1]
  const riderLng = ride.currentLocation?.coordinates?.[0]
  if (!riderLat || !riderLng) return null

  // Quick pre-filter: if passenger is >10 km straight-line from rider, skip OSRM call
  const directDistToRider = haversineKm(riderLat, riderLng, passengerLat, passengerLng)
  if (directDistToRider > 10) return null

  // Fetch rider's full route to college
  const routePoints = await fetchOSRMRoute(riderLat, riderLng, COLLEGE.lat, COLLEGE.lng)

  // ── No OSRM route available: fallback to straight-line check ─────────────
  if (!routePoints) {
    if (directDistToRider > 2) return null  // Same-route visibility limit
    const { km, fare } = calculateFare(passengerLat, passengerLng)
    return {
      distanceKm:         km,
      fareAmount:         fare,
      distToRoute:        0,
      pickupLat:          passengerLat,
      pickupLng:          passengerLng,
      needsToWalkToRoute: false,
      nearestRouteLat:    null,
      nearestRouteLng:    null,
      osrmAvailable:      false,
    }
  }

  // ── Find nearest point on route to passenger ──────────────────────────────
  const { nearestLat, nearestLng, distanceKm: distToRoute, routeIndex } =
    nearestPointOnRoute(routePoints, passengerLat, passengerLng)

  // ── Same-route visibility limit: 2 km ─────────────────────────────────────
  if (distToRoute > 2) return null

  // ── Ahead-of-rider check (no backtracking) ────────────────────────────────
  // The rider is at routePoints[0]. The nearest point on the route to the passenger
  // must be at or after the rider's current position (index > 0 means ahead).
  // We check by seeing if the nearest route point is closer to the college than
  // the rider is — i.e., the rider doesn't need to reverse direction.
  const riderToCollege    = haversineKm(riderLat, riderLng, COLLEGE.lat, COLLEGE.lng)
  const nearestToCollege  = haversineKm(nearestLat, nearestLng, COLLEGE.lat, COLLEGE.lng)

  // If the nearest route point is FURTHER from college than the rider → passenger
  // is behind the rider → rider would have to backtrack → reject.
  if (nearestToCollege > riderToCollege + 0.1) return null  // 100m tolerance

  // ── Calculate fare from passenger's actual location → college ─────────────
  const { km, fare } = calculateFare(passengerLat, passengerLng)

  // ── Pickup threshold: 1 km ────────────────────────────────────────────────
  if (distToRoute <= 1) {
    // Passenger is close enough to route — pick up at their exact location
    return {
      distanceKm:         km,
      fareAmount:         fare,
      distToRoute:        Number(distToRoute.toFixed(3)),
      pickupLat:          passengerLat,
      pickupLng:          passengerLng,
      needsToWalkToRoute: false,
      nearestRouteLat:    null,
      nearestRouteLng:    null,
      osrmAvailable:      true,
    }
  } else {
    // Passenger is 1–2 km from route — they must walk to the nearest route point.
    // Pickup point is set to the nearest main road point.
    return {
      distanceKm:         km,
      fareAmount:         fare,
      distToRoute:        Number(distToRoute.toFixed(3)),
      pickupLat:          nearestLat,   // rider picks up at route point
      pickupLng:          nearestLng,
      needsToWalkToRoute: true,         // frontend draws red walk path
      nearestRouteLat:    nearestLat,
      nearestRouteLng:    nearestLng,
      passengerActualLat: passengerLat, // passenger's real location (for red path start)
      passengerActualLng: passengerLng,
      osrmAvailable:      true,
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

  return results
    .filter(Boolean)
    .sort((a, b) => a.distToRoute - b.distToRoute)  // sort by proximity to route
}

// ── LOCK RIDE ─────────────────────────────────────────────────────────────────
export async function lockRide(rideId, { userId, name, phone, lat, lng }) {
  const ride = await Ride.findById(rideId)
  if (!ride)                     throw httpError("Ride not found.", 404)
  if (ride.status !== "pending") throw httpError("Ride no longer available.", 409)

  const pickupInfo = await getPickupInfo(ride, lat, lng)
  if (!pickupInfo) throw httpError("You are not on this rider's route.", 400)

  // ✅ Always calculate fare from passenger's actual location → college
  const { km, fare } = calculateFare(lat, lng)

  const otp = generateOTP()

  ride.passenger = {
    userId,
    name,
    phone,
    location: { type: "Point", coordinates: [lng, lat] },
  }
  ride.fare = {
    distanceKm:   km,    // ✅ passenger location → college
    amount:       fare,
    calculatedAt: new Date(),
  }
  ride.otp      = otp
  ride.status   = "locked"
  ride.lockedAt = new Date()
  await ride.save()

  return ride
}

// ── START RIDE ────────────────────────────────────────────────────────────────
export async function startRide(rideId, riderId) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride)                    throw httpError("Ride not found.", 404)
  if (ride.status !== "locked") throw httpError("Ride must be locked before starting.", 400)
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
    status: { $in: ["locked", "ongoing"] },
  }).lean()
}

// ── GET RIDER HISTORY ─────────────────────────────────────────────────────────
export async function getRiderHistory(riderId, limit = 20) {
  return Ride.find({ riderId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
}
// server/services/ride.service.js

import Ride from "../models/Ride.js"
import User from "../models/User.js"
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

// ── Per-ride route cache ──────────────────────────────────────────────────────
const rideRouteCache = new Map()
const ROUTE_TTL_MS = 10 * 60 * 1000  // 10 min

function getCachedRoute(rideId) {
  const entry = rideRouteCache.get(String(rideId))
  if (!entry) return undefined
  if (Date.now() - entry.ts > ROUTE_TTL_MS) { rideRouteCache.delete(String(rideId)); return undefined }
  return entry.points
}

function setCachedRoute(rideId, points) {
  rideRouteCache.set(String(rideId), { points, ts: Date.now() })
}

export function clearRideRouteCache(rideId) {
  rideRouteCache.delete(String(rideId))
}

// ── Core matching logic ───────────────────────────────────────────────────────
async function getPickupInfo(ride, passengerLat, passengerLng, destLat = COLLEGE.lat, destLng = COLLEGE.lng) {
  const riderLat = ride.currentLocation?.coordinates?.[1]
  const riderLng = ride.currentLocation?.coordinates?.[0]
  if (!riderLat || !riderLng) return null

  // Quick pre-filter: no point fetching route if passenger is very far
  const directDistToRider = haversineKm(riderLat, riderLng, passengerLat, passengerLng)
  if (directDistToRider > 15) return null

  // Fetch (or use cached) OSRM route: rider → college
  let routePoints = getCachedRoute(ride._id)
  if (routePoints === undefined) {
    routePoints = await fetchOSRMRoute(riderLat, riderLng, COLLEGE.lat, COLLEGE.lng)
    setCachedRoute(ride._id, routePoints)
  }

  // ── OSRM unavailable: fallback to straight-line 3km radius ───────────────
  if (!routePoints) {
    if (directDistToRider > 3) return null
    // Strict Filtering: when OSRM is down, quickly calculate if destination heavily deviates
    if (haversineKm(destLat, destLng, COLLEGE.lat, COLLEGE.lng) > 2) return null

    const { km, fare } = calculateFare(passengerLat, passengerLng)
    return {
      distanceKm: km, fareAmount: fare,
      distToRoute: Number(directDistToRider.toFixed(3)),
      pickupLat: passengerLat, pickupLng: passengerLng,
      needsToWalkToRoute: false,
      nearestRouteLat: null, nearestRouteLng: null,
      passengerActualLat: passengerLat, passengerActualLng: passengerLng,
      osrmAvailable: false,
    }
  }

  // ── Find nearest point on route for PASSENGER ─────────────────────────────
  const passengerNearest = nearestPointOnRoute(routePoints, passengerLat, passengerLng)
  const distToRoute = passengerNearest.distanceKm

  // Case 3: passenger pickup > 2km from route → not eligible
  if (distToRoute > 2) return null

  // ── Strict Destination Matching ───────────────────────────────────────────
  // If passenger destination deviates from rider route, reject entirely
  const destNearest = nearestPointOnRoute(routePoints, destLat, destLng)
  if (destNearest.distanceKm > 2) {
    console.log(`[pickup] DESTINATION FAIL — passenger dest is ${destNearest.distanceKm}km from route. Rejecting.`)
    return null
  }

  // Direction: Destination must be ahead of passenger pickup
  if (destNearest.routeIndex < passengerNearest.routeIndex) {
    console.log(`[pickup] DIRECTION FAIL — passenger destination is BEHIND pickup. Rejecting.`)
    return null
  }

  // ── Direction check for Rider using route index ───────────────────────────
  // The OSRM route runs: rider(index 0) → ... → college(index max)
  // Higher index = closer to college = AHEAD on the route.
  //
  // Find where the rider projects onto their own route.
  // The passenger's route index must be >= rider's route index,
  // meaning the passenger is ahead of (or level with) the rider.
  // If passenger index < rider index, the passenger is BEHIND the rider
  // (rider would have to turn back to pick them up) → reject.
  //
  // DIRECTION_SLACK: allow 2 segments of tolerance for GPS noise.
  const riderNearest = nearestPointOnRoute(routePoints, riderLat, riderLng)
  const DIRECTION_SLACK = 2

  if (passengerNearest.routeIndex < riderNearest.routeIndex - DIRECTION_SLACK) {
    console.log(
      `[pickup] DIRECTION FAIL — passenger idx=${passengerNearest.routeIndex} ` +
      `rider idx=${riderNearest.routeIndex} → passenger is BEHIND rider, rejecting`
    )
    return null
  }

  // ── Pickup point decision ─────────────────────────────────────────────────
  const { km, fare } = calculateFare(passengerLat, passengerLng)

  if (distToRoute <= 1) {
    // Case 1: within 1km of route → pick up at passenger's actual location
    return {
      distanceKm: km, fareAmount: fare,
      distToRoute: Number(distToRoute.toFixed(3)),
      pickupLat: passengerLat, pickupLng: passengerLng,
      needsToWalkToRoute: false,
      nearestRouteLat: null, nearestRouteLng: null,
      passengerActualLat: passengerLat, passengerActualLng: passengerLng,
      osrmAvailable: true,
    }
  } else {
    // Case 2: 1–2km from route → passenger must walk to nearest route point
    return {
      distanceKm: km, fareAmount: fare,
      distToRoute: Number(distToRoute.toFixed(3)),
      pickupLat: passengerNearest.nearestLat, pickupLng: passengerNearest.nearestLng,
      needsToWalkToRoute: true,
      nearestRouteLat: passengerNearest.nearestLat, nearestRouteLng: passengerNearest.nearestLng,
      passengerActualLat: passengerLat, passengerActualLng: passengerLng,
      osrmAvailable: true,
    }
  }
}

// ── GET NEARBY RIDES ──────────────────────────────────────────────────────────
export async function getNearbyRides(passengerLat, passengerLng, destLat = COLLEGE.lat, destLng = COLLEGE.lng) {
  if (!isValidCoord(passengerLat, passengerLng) || !isValidCoord(destLat, destLng))
    throw httpError("Invalid coordinates.")

  const allPending = await Ride.find({ status: "pending" })
    .populate("riderId", "ratingSum ratingCount")
    .lean()

  const results = await Promise.all(
    allPending.map(async (ride) => {
      const pickupInfo = await getPickupInfo(ride, passengerLat, passengerLng, destLat, destLng)
      if (!pickupInfo) return null
      const riderLat = ride.currentLocation?.coordinates?.[1]
      const riderLng = ride.currentLocation?.coordinates?.[0]
      const locationName = await reverseGeocode(riderLat, riderLng)
      return { 
        ...ride, 
        locationName, 
        ...pickupInfo,
        ratingSum: ride.riderId?.ratingSum || 0,
        ratingCount: ride.riderId?.ratingCount || 0
      }
    })
  )

  return results.filter(Boolean).sort((a, b) => a.distToRoute - b.distToRoute)
}

// ── LOCK RIDE ─────────────────────────────────────────────────────────────────
export async function lockRide(rideId, { userId, name, phone, lat, lng, destLat, destLng }) {
  const ride = await Ride.findById(rideId)
  if (!ride) throw httpError("Ride not found.", 404)
  if (ride.status !== "pending") throw httpError("Ride no longer available.", 409)

  const dLat = destLat ? parseFloat(destLat) : COLLEGE.lat
  const dLng = destLng ? parseFloat(destLng) : COLLEGE.lng

  const pickupInfo = await getPickupInfo(ride, lat, lng, dLat, dLng)
  if (!pickupInfo) throw httpError("You are not on this rider's route.", 400)

  const { km, fare } = calculateFare(lat, lng)
  const otp = generateOTP()
  const pAddress = await reverseGeocode(lat, lng)

  ride.passenger = {
    userId, name, phone,
    location: { type: "Point", coordinates: [lng, lat] },
    pickupAddress: pAddress,
  }
  ride.fare = { distanceKm: km, amount: fare, calculatedAt: new Date() }
  ride.otp = otp
  ride.status = "locked"
  ride.lockedAt = new Date()
  await ride.save()
  return ride
}

export async function startPickup(rideId, riderId) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride) throw httpError("Ride not found.", 404)
  if (ride.status !== "locked") return ride
  ride.status = "pickup_started"
  await ride.save()
  return ride
}

export async function arriveAtPickup(rideId, riderId) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride) throw httpError("Ride not found.", 404)
  if (ride.status === "locked") {
    ride.status = "pickup_started"
    await ride.save()
  }
  return ride
}

export async function startRide(rideId, riderId, otp) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride) throw httpError("Ride not found.", 404)
  if (!["locked", "pickup_started", "ongoing"].includes(ride.status))
    throw httpError("Ride must be locked or pickup_started before starting.", 400)

  if (!otp || ride.otp !== otp) throw httpError("Please re-check and enter the correct OTP.", 400)

  ride.status = "ongoing"
  ride.startedAt = new Date()
  await ride.save()
  clearRideRouteCache(rideId)
  return ride
}

export async function reachDestination(rideId, riderId) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride) throw httpError("Ride not found.", 404)
  if (ride.status === "completed") return ride
  if (!["ongoing", "reached_destination"].includes(ride.status))
    throw httpError("Ride must be ongoing to reach destination.", 400)
  ride.status = "reached_destination"
  ride.reachedAt = new Date()
  await ride.save()
  clearRideRouteCache(rideId)
  return ride
}

// ── COMPLETE RIDE ─────────────────────────────────────────────────────────────
export async function completeRide(rideId, riderId, paymentMethod) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride) throw httpError("Ride not found.", 404)
  if (!["ongoing", "reached_destination"].includes(ride.status)) throw httpError("Ride must be ongoing to complete.", 400)
  ride.status = "completed"
  ride.completedAt = new Date()
  ride.payment.method = paymentMethod || "cash"
  ride.payment.status = "paid"
  await ride.save()
  clearRideRouteCache(rideId)
  return ride
}

// ── REJECT PASSENGER ──────────────────────────────────────────────────────────
export async function rejectPassenger(rideId, riderId) {
  const ride = await Ride.findOne({ _id: rideId, riderId })
  if (!ride) throw httpError("Ride not found.", 404)
  ride.passenger = null
  ride.fare = null
  ride.otp = null
  ride.status = "pending"
  ride.lockedAt = null
  await ride.save()
  return ride
}

// ── GET PASSENGER ACTIVE RIDE ─────────────────────────────────────────────────
export async function getPassengerActiveRide(userId) {
  return Ride.findOne({
    "passenger.userId": userId,
    status: { $in: ["locked", "pickup_started", "ongoing", "reached_destination"] },
  }).lean()
}

// ── REVIEW RIDE (PASSENGER RATING RIDER) ──────────────────────────────────────
export async function reviewRide(rideId, userId, { rating, review }) {
  const ride = await Ride.findById(rideId)
  if (!ride) throw httpError("Ride not found.", 404)

  // 1. Update the ride record
  ride.riderReview = {
    rating: Number(rating),
    text: review || "",
    givenAt: new Date(),
  }
  await ride.save()

  // 2. Update the Rider's aggregate statistics in User model
  // We use incrementing to ensure multiple reviews don't overwrite each other
  await User.findByIdAndUpdate(ride.riderId, {
    $inc: {
      ratingSum: Number(rating),
      ratingCount: 1
    }
  })

  return ride
}

// ── GET RIDER HISTORY ─────────────────────────────────────────────────────────
export async function getRiderHistory(riderId, limit = 20) {
  return Ride.find({ riderId }).sort({ createdAt: -1 }).limit(limit).lean()
}
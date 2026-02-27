// server/services/ride.service.js
// ─────────────────────────────────────────────────────────────────────────────
// ALL ride business logic lives here.
// Controllers just call these functions and return the result as JSON.
// This makes the logic portable and unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

import Ride from "../models/Ride.js"
import {
  COLLEGE,
  calculateFare,
  isWithinPickupRadius,
  isValidCoord,
  generateOTP,
  haversineKm,
} from "../utils/geo.js"

// ─────────────────────────────────────────────────────────────────────────────
// Helper: throw a clean HTTP error
// ─────────────────────────────────────────────────────────────────────────────
function httpError(message, status = 400) {
  const err = new Error(message)
  err.status = status
  return err
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST A RIDE  →  POST /api/rides
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rider broadcasts: "I'm heading to college from [origin], who wants a ride?"
 * Fare is NOT set here — it depends on which passenger books.
 */
export async function postRide({ riderId, riderName, origin, departureTime }) {
  // Validate coordinates before they ever reach OSRM or the DB
  if (!isValidCoord(origin.lat, origin.lng)) {
    throw httpError("Invalid origin coordinates. Check lat/lng values.")
  }

  // Prevent a rider from having two active rides simultaneously
  const duplicate = await Ride.findOne({ riderId, status: { $in: ["posted", "matched"] } })
  if (duplicate) {
    throw httpError("You already have an active ride. Cancel it first.", 409)
  }

  const ride = await Ride.create({
    riderId,
    riderName,
    origin,
    destination:   COLLEGE,           // always fixed
    departureTime: departureTime || "Now",
    status:        "posted",
  })

  return ride
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FIND NEARBY RIDES  →  GET /api/rides/nearby?lat=&lng=
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns all "posted" rides whose origin is within 3 km of the passenger.
 * Each result includes a fare PREVIEW based on the passenger's own location.
 *
 * This is the passenger-facing discovery endpoint — wired up now for future use.
 */
export async function findNearbyRides({ passengerLat, passengerLng }) {
  if (!isValidCoord(passengerLat, passengerLng)) {
    throw httpError("Invalid passenger coordinates.")
  }

  // Fetch all posted rides (for a college app this set is always small)
  const allPosted = await Ride.find({ status: "posted" }).lean()

  const nearby = allPosted
    .map((ride) => {
      // ── Is this rider within 3 km of the passenger? ──────────────────────
      const { valid, distanceKm: riderToPassengerKm } = isWithinPickupRadius(
        ride.origin.lat, ride.origin.lng,
        passengerLat,    passengerLng
      )
      if (!valid) return null

      // ── Fare preview: passenger's location → college ──────────────────────
      const { km: passengerToCollegeKm, fare } = calculateFare(passengerLat, passengerLng)

      return {
        rideId:               ride._id,
        riderId:              ride.riderId,
        riderName:            ride.riderName,
        riderOrigin:          ride.origin,
        departureTime:        ride.departureTime,
        riderToPassengerKm,          // how far the rider is from this passenger
        passengerToCollegeKm,        // distance used for the fare calculation
        fare,                        // ₹ the passenger would pay
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.riderToPassengerKm - b.riderToPassengerKm)  // closest first

  return nearby
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ACCEPT / BOOK A RIDE  →  POST /api/rides/:rideId/accept
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Passenger books a posted ride.
 * Steps:
 *   1. Check ride is still "posted"
 *   2. Validate passenger is ≤ 3 km from rider
 *   3. Calculate fare (passenger ↔ college only)
 *   4. Generate OTP
 *   5. Transition ride status: posted → matched
 */
export async function acceptRide({ rideId, passengerId, passengerName, passengerPickup }) {
  if (!isValidCoord(passengerPickup.lat, passengerPickup.lng)) {
    throw httpError("Invalid passenger pickup coordinates.")
  }

  const ride = await Ride.findById(rideId)
  if (!ride)                     throw httpError("Ride not found.", 404)
  if (ride.status !== "posted")  throw httpError("This ride is no longer available.", 409)
  if (ride.passengerId)          throw httpError("Ride already has a passenger.", 409)

  // ── 3 km radius check ────────────────────────────────────────────────────
  const { valid, distanceKm } = isWithinPickupRadius(
    ride.origin.lat, ride.origin.lng,
    passengerPickup.lat, passengerPickup.lng
  )
  if (!valid) {
    throw httpError(
      `You are ${distanceKm} km from the rider. Maximum allowed is 3 km.`,
      400
    )
  }

  // ── Fare calculation (passenger → college ONLY) ───────────────────────────
  const { km: passengerToCollegeKm, fare } = calculateFare(
    passengerPickup.lat, passengerPickup.lng
  )

  // ── Atomic update ─────────────────────────────────────────────────────────
  ride.passengerId          = passengerId
  ride.passengerName        = passengerName
  ride.passengerPickup      = passengerPickup
  ride.passengerToCollegeKm = passengerToCollegeKm
  ride.fare                 = fare
  ride.otp                  = generateOTP()
  ride.status               = "matched"
  ride.matchedAt            = new Date()
  await ride.save()

  return {
    rideId:               ride._id,
    otp:                  ride.otp,          // ← send to PASSENGER only, not rider
    fare,
    passengerToCollegeKm,
    riderName:            ride.riderName,
    riderOrigin:          ride.origin,
    passengerPickup:      ride.passengerPickup,
    destination:          ride.destination,
    departureTime:        ride.departureTime,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. VERIFY OTP + CONFIRM PICKUP  →  POST /api/rides/:rideId/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rider enters the OTP given verbally by the passenger.
 * On success: status → picked_up, OTP is cleared.
 */
export async function verifyOtpAndPickup({ rideId, riderId, enteredOtp }) {
  const ride = await Ride.findOne({ _id: rideId, riderId })

  if (!ride)                     throw httpError("Ride not found.", 404)
  if (ride.status !== "matched") throw httpError("Ride is not awaiting OTP verification.", 400)
  if (ride.otp !== enteredOtp)   throw httpError("Incorrect OTP. Please try again.", 401)

  ride.status     = "picked_up"
  ride.pickedUpAt = new Date()
  ride.otpUsedAt  = new Date()
  ride.otp        = null        // clear the OTP — single use only
  await ride.save()

  return {
    rideId:      ride._id,
    status:      ride.status,
    pickedUpAt:  ride.pickedUpAt,
    destination: ride.destination,
    fare:        ride.fare,
    passengerName: ride.passengerName,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMPLETE RIDE  →  PATCH /api/rides/:rideId/complete
// ─────────────────────────────────────────────────────────────────────────────
export async function completeRide({ rideId, riderId }) {
  const ride = await Ride.findOne({ _id: rideId, riderId })

  if (!ride)                       throw httpError("Ride not found.", 404)
  if (ride.status !== "picked_up") throw httpError("Ride must be in 'picked_up' status to complete.", 400)

  ride.status      = "completed"
  ride.completedAt = new Date()
  await ride.save()

  return {
    rideId:      ride._id,
    status:      "completed",
    fare:        ride.fare,
    completedAt: ride.completedAt,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CANCEL RIDE  →  PATCH /api/rides/:rideId/cancel
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelRide({ rideId, riderId }) {
  const ride = await Ride.findOne({ _id: rideId, riderId })

  if (!ride) throw httpError("Ride not found.", 404)
  if (["completed", "cancelled"].includes(ride.status)) {
    throw httpError("Cannot cancel a completed or already-cancelled ride.", 400)
  }

  ride.status = "cancelled"
  await ride.save()

  return { rideId: ride._id, status: "cancelled" }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. UTILITY: GET SINGLE RIDE  →  GET /api/rides/:rideId
// ─────────────────────────────────────────────────────────────────────────────
export async function getRideById(rideId) {
  const ride = await Ride.findById(rideId).lean()
  if (!ride) throw httpError("Ride not found.", 404)
  return ride
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. RIDER HISTORY  →  GET /api/rides/rider/:riderId
// ─────────────────────────────────────────────────────────────────────────────
export async function getRiderHistory(riderId, limit = 20) {
  return Ride.find({ riderId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
}
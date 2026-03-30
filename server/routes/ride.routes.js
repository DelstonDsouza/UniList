// server/routes/ride.routes.js

import express from "express"
import { io } from "../index.js"
import Ride from "../models/Ride.js"
import User from "../models/User.js"
import * as rideService from "../services/ride.service.js"
import auth from "../middleware/auth.js"
import { reverseGeocode } from "../utils/geo.js"

const router = express.Router()
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// ── PASSENGER ROUTES ──────────────────────────────────────────────────────────

router.get("/nearby", auth, wrap(async (req, res) => {
  const { lat, lng } = req.query
  if (!lat || !lng) return res.status(400).json({
    success: false,
    error: { code: "MISSING_COORDS", message: "lat and lng query params required" },
  })
  const rides = await rideService.getNearbyRides(parseFloat(lat), parseFloat(lng))

  // Enrichment: fetch rider's vehicle and rating info
  const riderIds = [...new Set(rides.map(r => String(r.riderId)))]
  const riders = await User.find({ _id: { $in: riderIds } }, { vehicleNo: 1, ratingSum: 1, ratingCount: 1 }).lean()
  const riderInfoMap = Object.fromEntries(riders.map(u => [String(u._id), {
    vehicleNo: u.vehicleNo || "",
    ratingSum: u.ratingSum || 0,
    ratingCount: u.ratingCount || 0
  }]))

  const enriched = rides.map(r => {
    const info = riderInfoMap[String(r.riderId)] || { vehicleNo: "", ratingSum: 0, ratingCount: 0 }
    return {
      ...r,
      vehicleNo: info.vehicleNo,
      ratingSum: info.ratingSum,
      ratingCount: info.ratingCount
    }
  })

  res.json({ success: true, data: { rides: enriched } })
}))

router.post("/:id/request", auth, wrap(async (req, res) => {
  const { passengerLat, passengerLng, name, phone } = req.body
  const rideId = req.params.id

  if (!passengerLat || !passengerLng) return res.status(400).json({
    success: false,
    error: { code: "MISSING_COORDS", message: "passengerLat and passengerLng required" },
  })
  if (!name || !phone) return res.status(400).json({
    success: false,
    error: { code: "MISSING_FIELDS", message: "name and phone required" },
  })

  const pLat = parseFloat(passengerLat)
  const pLng = parseFloat(passengerLng)

  const ride = await rideService.lockRide(rideId, {
    userId: req.user._id,
    name: name || req.user.firstName,
    phone: phone || req.user.phone,
    lat: pLat,
    lng: pLng,
  })

  const pickupLat = ride.passenger?.location?.coordinates?.[1] ?? pLat
  const pickupLng = ride.passenger?.location?.coordinates?.[0] ?? pLng

  io.to(`ride:${ride._id}`).emit("ride:locked", {
    rideId: String(ride._id),
    passengerName: ride.passenger.name,
    passengerPhone: ride.passenger.phone,
    passengerLat: pickupLat,
    passengerLng: pickupLng,
    fare: ride.fare.amount,
    distanceKm: ride.fare.distanceKm,
  })

  io.to("riders-watch").emit("ride:locked", { rideId: String(ride._id) })
  res.json({ success: true, data: { ride } })
}))

router.get("/active", auth, wrap(async (req, res) => {
  const ride = await rideService.getPassengerActiveRide(req.user._id)
  res.json({ success: true, data: { ride } })
}))

// ── PASSENGER RIDE HISTORY ────────────────────────────────────────────────────
router.get("/history", auth, wrap(async (req, res) => {
  const { riderId } = req.query
  let query

  if (riderId) {
    // Rider's own history
    query = { riderId: req.user._id, status: { $in: ["completed", "cancelled"] } }
  } else {
    // Passenger's history
    query = { "passenger.userId": req.user._id, status: { $in: ["completed", "cancelled"] } }
  }

  const rides = await Ride.find(query).sort({ createdAt: -1 }).limit(30).lean()

  // Reverse-geocode pickup coord ONLY if missing, to prevent rate limits
  const formatted = await Promise.all(rides.map(async r => {
    let finalPickupLocation = r.pickupAddress

    if (!finalPickupLocation) {
      if (r.passenger?.pickupAddress) {
        finalPickupLocation = r.passenger.pickupAddress
      } else {
        const coords = r.passenger?.location?.coordinates
        if (coords?.[0] && coords?.[1]) {
          finalPickupLocation = await reverseGeocode(coords[1], coords[0])
          // Fire-and-forget save so next load is instant
          Ride.updateOne({ _id: r._id }, { $set: { "passenger.pickupAddress": finalPickupLocation } }).exec().catch(() => {})
        } else {
          const rCoords = r.pickupLocation?.coordinates
          if (rCoords?.[0] && rCoords?.[1]) {
            finalPickupLocation = await reverseGeocode(rCoords[1], rCoords[0])
            Ride.updateOne({ _id: r._id }, { $set: { pickupAddress: finalPickupLocation } }).exec().catch(() => {})
          }
        }
      }
    }

    return {
      _id: r._id,
      status: r.status,
      riderName: r.riderName,
      passengerName: r.passenger?.name || null,
      fare: r.fare?.amount ?? null,
      distanceKm: r.fare?.distanceKm ?? null,
      departureTime: r.departureTimeStr || r.departureTime || null,
      createdAt: r.createdAt,
      pickupLocation: finalPickupLocation || "Unknown Location",
      destination: "St Aloysius College, Mangalore",
      passengerReview: r.passengerReview || null,
      riderReview: r.riderReview || null,
    }
  }))

  res.json({ success: true, rides: formatted })
}))

// ── RIDER ROUTES ──────────────────────────────────────────────────────────────

router.post("/", auth, wrap(async (req, res) => {
  const {
    riderName, riderPhone,
    pickupLat, pickupLng, currentLat, currentLng,
    departureTime, departureTimeStr, pickupAddress
  } = req.body

  if (!pickupLat || !pickupLng || !currentLat || !currentLng) return res.status(400).json({
    success: false,
    error: { code: "MISSING_COORDS", message: "Location coordinates required" },
  })

  const existing = await Ride.findOne({
    riderId: req.user._id,
    status: { $in: ["pending", "locked", "pickup_started", "ongoing"] },
  })
  if (existing) {
    if (existing.status === "pending") {
      await Ride.findByIdAndUpdate(existing._id, { $set: { status: "cancelled" } })
      io.to("riders-watch").emit("ride:removed", { rideId: String(existing._id) })
      console.log(`Auto-cancelled previous pending ride ${existing._id}`)
    } else {
      return res.status(400).json({
        success: false,
        error: { code: "ACTIVE_RIDE_EXISTS", message: "Complete your current ride before posting a new one" },
      })
    }
  }

  const ride = await Ride.create({
    riderId: req.user._id,
    riderName: riderName || req.user.firstName || "Rider",
    riderPhone: riderPhone || req.user.phone || "",
    departureTime: departureTime || null,
    departureTimeStr: departureTimeStr || departureTime || "",
    currentLocation: {
      type: "Point",
      coordinates: [parseFloat(currentLng), parseFloat(currentLat)],
    },
    pickupLocation: {
      type: "Point",
      coordinates: [parseFloat(pickupLng), parseFloat(pickupLat)],
    },
    pickupAddress: pickupAddress || "",
    status: "pending",
  })

  io.to("riders-watch").emit("ride:new", { ride })
  res.status(201).json({ success: true, data: { ride } })
}))

router.get("/my", auth, wrap(async (req, res) => {
  const rides = await Ride.find({ riderId: req.user._id })
    .sort({ createdAt: -1 }).limit(20).lean()
  res.json({ success: true, data: { rides } })
}))

// ── GET SINGLE RIDE ───────────────────────────────────────────────────────────
router.get("/:id", auth, wrap(async (req, res) => {
  const ride = await Ride.findById(req.params.id).lean()
  if (!ride) return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } })
  res.json({ success: true, data: { ride } })
}))

// ── CANCEL ────────────────────────────────────────────────────────────────────
router.post("/:id/cancel", auth, wrap(async (req, res) => {
  const ride = await Ride.findOne({ _id: req.params.id, riderId: req.user._id })
  if (!ride) {
    console.log(`Cancel 404 for ride ${req.params.id} — already cancelled or not found`)
    return res.json({ success: true, alreadyCancelled: true })
  }
  if (ride.status === "cancelled") return res.json({ success: true, alreadyCancelled: true })

  if (ride.passenger?.userId) {
    await User.findByIdAndUpdate(ride.passenger.userId, { $set: { activeRideId: null } })
    io.to(`ride:${ride._id}`).emit("ride:cancelled", { rideId: String(ride._id) })
  }

  await Ride.findByIdAndUpdate(ride._id, { $set: { status: "cancelled" } })
  const room = io.sockets.adapter.rooms.get("riders-watch")
  console.log(`Ride ${ride._id} cancelled — notifying ${room?.size || 0} passengers in riders-watch`)
  io.to("riders-watch").emit("ride:removed", { rideId: String(ride._id) })
  res.json({ success: true })
}))

// ── PICKUP STARTED — rider clicks "Go Pick Up Passenger" ─────────────────────
router.post("/:id/pickup-start", auth, wrap(async (req, res) => {
  const ride = await Ride.findOne({ _id: req.params.id, riderId: req.user._id })
  if (!ride) return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } })
  if (ride.status !== "locked") return res.status(400).json({
    success: false,
    error: { code: "INVALID_STATUS", message: "Ride must be locked to start pickup" },
  })
  await Ride.findByIdAndUpdate(ride._id, { $set: { status: "pickup_started" } })
  io.to(`ride:${ride._id}`).emit("ride:pickup_started", { rideId: String(ride._id) })
  res.json({ success: true })
}))

// ── START RIDE ────────────────────────────────────────────────────────────────
router.post("/:id/start", auth, wrap(async (req, res) => {
  const ride = await rideService.startRide(req.params.id, req.user._id)
  io.to(`ride:${ride._id}`).emit("ride:started", { rideId: String(ride._id) })
  res.json({ success: true, data: { ride } })
}))

// ── REACHED DESTINATION ──────────────────────────────────────────────────────
router.post("/:id/reached", auth, wrap(async (req, res) => {
  const ride = await Ride.findOne({ _id: req.params.id, riderId: req.user._id })
  if (!ride) return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } })
  if (ride.status !== "ongoing") return res.status(400).json({
    success: false,
    error: { code: "INVALID_STATUS", message: "Ride must be ongoing to mark as reached" },
  })
  await Ride.findByIdAndUpdate(ride._id, {
    $set: { status: "reached_destination", reachedAt: new Date() }
  })
  const distanceKm = ride.fare?.distanceKm
  const fareAmount = ride.fare?.amount
  // Notify both rider and passenger
  io.to(`ride:${ride._id}`).emit("ride:reached_destination", {
    rideId: String(ride._id),
    distanceKm,
    fare: fareAmount,
  })
  res.json({ success: true, data: { distanceKm, fare: fareAmount } })
}))

// ── COMPLETE ──────────────────────────────────────────────────────────────────
router.post("/:id/complete", auth, wrap(async (req, res) => {
  const ride = await Ride.findOne({ _id: req.params.id, riderId: req.user._id })
  if (!ride) return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } })
  if (!['reached_destination', 'ongoing'].includes(ride.status)) return res.status(400).json({
    success: false,
    error: { code: "INVALID_STATUS", message: "Ride must be ongoing or reached to complete" },
  })
  const distKm = ride.fare?.distanceKm
  const amount = ride.fare?.amount
  await Ride.findByIdAndUpdate(ride._id, {
    $set: { status: "completed", completedAt: new Date(), 'payment.method': 'cash', 'payment.status': 'paid' }
  })
  // Clear active ride from user records
  await User.findByIdAndUpdate(ride.riderId, { $set: { activeRideId: null } })
  if (ride.passenger?.userId) {
    await User.findByIdAndUpdate(ride.passenger.userId, { $set: { activeRideId: null } })
  }
  io.to(`ride:${ride._id}`).emit("ride:completed", {
    rideId: String(ride._id), distanceKm: distKm, fare: amount,
  })
  res.json({ success: true, data: { distanceKm: distKm, fare: amount } })
}))

// ── REJECT PASSENGER ──────────────────────────────────────────────────────────
router.post("/:id/reject-passenger", auth, wrap(async (req, res) => {
  const ride = await rideService.rejectPassenger(req.params.id, req.user._id)
  res.json({ success: true, data: { ride } })
}))

// ── REVIEW ─────────────────────────────────────────────────────────────────────
router.post("/:id/review", auth, wrap(async (req, res) => {
  const { rating, review } = req.body
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: { code: "INVALID_RATING", message: "Rating must be 1–5" } })
  }

  const ride = await Ride.findById(req.params.id)
  if (!ride) return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } })
  if (ride.status !== "completed") {
    return res.status(400).json({ success: false, error: { code: "INVALID_STATUS", message: "Ride must be completed" } })
  }

  const isRider = String(ride.riderId) === String(req.user._id)
  const isPassenger = ride.passenger?.userId && String(ride.passenger.userId) === String(req.user._id)

  if (isRider) {
    // Rider rates the passenger
    if (ride.riderReview?.rating) return res.status(409).json({ success: false, error: { code: "ALREADY_REVIEWED" } })
    await Ride.findByIdAndUpdate(ride._id, { $set: { riderReview: { rating, text: review || "", givenAt: new Date() } } })
    if (ride.passenger?.userId) {
      await User.findByIdAndUpdate(ride.passenger.userId, {
        $inc: { passengerRatingSum: rating, passengerRatingCount: 1 }
      })
    }
  } else if (isPassenger) {
    // Passenger rates the rider
    if (ride.passengerReview?.rating) return res.status(409).json({ success: false, error: { code: "ALREADY_REVIEWED" } })
    await Ride.findByIdAndUpdate(ride._id, { $set: { passengerReview: { rating, text: review || "", givenAt: new Date() } } })
    await User.findByIdAndUpdate(ride.riderId, {
      $inc: { ratingSum: rating, ratingCount: 1 }
    })
  } else {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN" } })
  }

  res.json({ success: true })
}))

// ── LOCATION UPDATE ───────────────────────────────────────────────────────────
router.patch("/:id/location", auth, wrap(async (req, res) => {
  const { lat, lng } = req.body
  if (!lat || !lng) return res.status(400).json({ success: false, error: { code: "MISSING_COORDS" } })
  await Ride.findOneAndUpdate(
    { _id: req.params.id, riderId: req.user._id },
    { $set: { currentLocation: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] } } }
  )
  res.json({ success: true })
}))

// ── Error handler ─────────────────────────────────────────────────────────────
router.use((err, req, res, _next) => {
  console.error("RIDE ROUTE ERROR:", err?.stack || err)
  const status = err.status || 500
  res.status(status).json({
    success: false,
    error: { code: err.code || "SERVER_ERROR", message: err.message || "Something went wrong" },
  })
})

export default router
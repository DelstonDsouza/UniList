// server/routes/ride.routes.js

import express from "express"
import { io } from "../index.js"
import Ride from "../models/Ride.js"
import User from "../models/User.js"
import * as rideService from "../services/ride.service.js"
import auth from "../middleware/auth.js"

const router = express.Router()
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// ─────────────────────────────────────────────────────────────
// PASSENGER ROUTES
// ─────────────────────────────────────────────────────────────

router.get("/nearby", auth, wrap(async (req, res) => {
  const { lat, lng } = req.query
  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_COORDS", message: "lat and lng query params required" },
    })
  }
  const rides = await rideService.getNearbyRides(parseFloat(lat), parseFloat(lng), null)
  res.json({ success: true, data: { rides } })
}))

router.post("/:id/request", auth, wrap(async (req, res) => {
  const { passengerLat, passengerLng, name, phone } = req.body
  const rideId = req.params.id

  if (!passengerLat || !passengerLng) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_COORDS", message: "passengerLat and passengerLng required" },
    })
  }
  if (!name || !phone) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_FIELDS", message: "name and phone required" },
    })
  }

  const ride = await rideService.lockRide(
    rideId,
    {
      userId: req.user._id,
      name:   name  || req.user.firstName,
      phone:  phone || req.user.phone,
      lat:    parseFloat(passengerLat),
      lng:    parseFloat(passengerLng),
    },
    null
  )

  res.json({ success: true, data: { ride } })
}))

router.get("/active", auth, wrap(async (req, res) => {
  const ride = await rideService.getPassengerActiveRide(req.user._id)
  res.json({ success: true, data: { ride } })
}))

// ─────────────────────────────────────────────────────────────
// RIDER ROUTES
// ─────────────────────────────────────────────────────────────

router.post("/", auth, wrap(async (req, res) => {
  const {
    riderName, riderPhone, scooterNumber,
    pickupLat, pickupLng, currentLat, currentLng,
    departureTime,
  } = req.body

  if (!pickupLat || !pickupLng || !currentLat || !currentLng) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_COORDS", message: "Location coordinates required" },
    })
  }

  // Check if rider already has an active ride
  const existing = await Ride.findOne({
    riderId: req.user._id,
    status: { $in: ["pending", "locked", "ongoing"] },
  })
  if (existing) {
    if (existing.status === "pending") {
      // Auto-cancel previous pending ride (handles StrictMode double-post + fast cancel+repost)
      await Ride.findByIdAndUpdate(existing._id, { $set: { status: "cancelled" } })
      io.to("riders-watch").emit("ride:removed", { rideId: String(existing._id) })
      console.log(`Auto-cancelled previous pending ride ${existing._id} — allowing new post`)
      // Fall through to create new ride
    } else {
      // locked or ongoing — rider must complete it first
      return res.status(400).json({
        success: false,
        error: { code: "ACTIVE_RIDE_EXISTS", message: "Complete your current ride before posting a new one" },
      })
    }
  }

  const ride = await Ride.create({
    collegeId:    null,
    riderId:      req.user._id,
    riderName:    riderName  || req.user.firstName || "Rider",
    riderPhone:   riderPhone || req.user.phone     || "",
    scooterNumber: scooterNumber || "N/A",
    departureTime: departureTime || null,
    currentLocation: {
      type: "Point",
      coordinates: [parseFloat(currentLng), parseFloat(currentLat)],
    },
    pickupLocation: {
      type: "Point",
      coordinates: [parseFloat(pickupLng), parseFloat(pickupLat)],
    },
    status: "pending",
  })

  // Notify all watching passengers instantly
  io.to("riders-watch").emit("ride:new", { ride })

  res.status(201).json({ success: true, data: { ride } })
}))

router.get("/my", auth, wrap(async (req, res) => {
  const rides = await Ride.find({ riderId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()
  res.json({ success: true, data: { rides } })
}))

// ─────────────────────────────────────────────────────────────
// CANCEL — works for pending, locked, ongoing
// ─────────────────────────────────────────────────────────────
router.post("/:id/cancel", auth, wrap(async (req, res) => {
  const ride = await Ride.findOne({ _id: req.params.id, riderId: req.user._id })

  if (!ride) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Ride not found" },
    })
  }

  // If a passenger was locked in, free them
  if (ride.passenger?.userId) {
    await User.findByIdAndUpdate(ride.passenger.userId, {
      $set: { activeRideId: null },
    })
    io.to(`ride:${ride._id}`).emit("ride:cancelled", { rideId: String(ride._id) })
  }

  // Mark as cancelled
  await Ride.findByIdAndUpdate(ride._id, { $set: { status: "cancelled" } })

  // Remove from all passengers' discovery lists
  const room = io.sockets.adapter.rooms.get("riders-watch")
  console.log(`Ride ${ride._id} cancelled — notifying ${room?.size || 0} passengers in riders-watch`)
  io.to("riders-watch").emit("ride:removed", { rideId: String(ride._id) })
  res.json({ success: true })
}))

router.post("/:id/start", auth, wrap(async (req, res) => {
  const ride = await rideService.startRide(req.params.id, req.user._id)
  io.to(`ride:${ride._id}`).emit("ride:started", { rideId: String(ride._id) })
  res.json({ success: true, data: { ride } })
}))

router.post("/:id/complete", auth, wrap(async (req, res) => {
  const ride = await rideService.completeRide(req.params.id, req.user._id, req.body.paymentMethod)
  io.to(`ride:${ride._id}`).emit("ride:completed", { rideId: String(ride._id) })
  res.json({ success: true, data: { ride } })
}))

router.post("/:id/reject-passenger", auth, wrap(async (req, res) => {
  const ride = await rideService.rejectPassenger(req.params.id, req.user._id)
  res.json({ success: true, data: { ride } })
}))

router.patch("/:id/location", auth, wrap(async (req, res) => {
  const { lat, lng } = req.body
  if (!lat || !lng) {
    return res.status(400).json({ success: false, error: { code: "MISSING_COORDS" } })
  }
  await Ride.findOneAndUpdate(
    { _id: req.params.id, riderId: req.user._id },
    { $set: { currentLocation: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] } } }
  )
  res.json({ success: true })
}))

// ─────────────────────────────────────────────────────────────
// Error handler
// ─────────────────────────────────────────────────────────────
router.use((err, req, res, _next) => {
  console.error("RIDE ROUTE ERROR:", err?.stack || err)
  const status = err.status || 500
  res.status(status).json({
    success: false,
    error: {
      code:    err.code    || "SERVER_ERROR",
      message: err.message || "Something went wrong",
    },
  })
})

export default router
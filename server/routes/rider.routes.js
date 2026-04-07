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
  const { lat, lng, destLat, destLng } = req.query
  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_COORDS", message: "lat and lng query params required" },
    })
  }
  const dLat = destLat ? parseFloat(destLat) : undefined
  const dLng = destLng ? parseFloat(destLng) : undefined
  const rides = await rideService.getNearbyRides(parseFloat(lat), parseFloat(lng), dLat, dLng)
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
      name: name || req.user.firstName,
      phone: phone || req.user.phone,
      lat: parseFloat(passengerLat),
      lng: parseFloat(passengerLng),
      destLat: req.body.destLat,
      destLng: req.body.destLng,
    }
  )

  // Emit to rider instantly with correct pickup point
  io.to(`ride:${ride._id}`).emit("ride:locked", {
    rideId: String(ride._id),
    passengerName: ride.passenger.name,
    passengerPhone: ride.passenger.phone,
    // Pickup point (may be nearest road point if passenger is >1km from route)
    passengerLat: ride._pickupLat,
    passengerLng: ride._pickupLng,
    needsToWalkToRoute: ride._needsToWalkToRoute,
    passengerActualLat: ride._passengerActualLat,
    passengerActualLng: ride._passengerActualLng,
    fare: ride.fare.amount,
    distanceKm: ride.fare.distanceKm,
  })

  // Remove from all passengers' lists
  io.to("riders-watch").emit("ride:locked", { rideId: String(ride._id) })

  res.json({ success: true, data: { ride } })
}))

router.get("/active", auth, wrap(async (req, res) => {
  const ride = await rideService.getPassengerActiveRide(req.user._id)
  res.json({ success: true, data: { ride } })
}))

// ─────────────────────────────────────────────────────────────
// RIDER ROUTES
// ─────────────────────────────────────────────────────────────

router.post("/register", auth, wrap(async (req, res) => {
  const { licenseNo, vehicleNo, vehicleType } = req.body
  console.log("📝 Registering rider:", { uid: req.user._id, licenseNo, vehicleNo, vehicleType })

  // Lenient regexes to prevent 400 errors for valid but differently formatted inputs
  // Vehicle: Allow alphanumeric plus spaces/hyphens, min 6 chars
  const vehicleRegex = /^[A-Z0-9\s-]{6,15}$/i
  // License: Allow alphanumeric plus spaces/hyphens, min 10 chars
  const licenseRegex = /^[A-Z0-9\s-]{10,24}$/i

  if (!vehicleNo || !vehicleRegex.test(vehicleNo)) {
    console.warn("❌ Registration failed: Invalid vehicleNo", vehicleNo)
    return res.status(400).json({ success: false, error: { message: "Invalid vehicle number. Please enter a valid registration number (e.g. KA 01 AB 1234)" } })
  }
  if (!licenseNo || !licenseRegex.test(licenseNo)) {
    console.warn("❌ Registration failed: Invalid licenseNo", licenseNo)
    return res.status(400).json({ success: false, error: { message: "Invalid license number. Please enter your license number correctly." } })
  }

  const user = await User.findByIdAndUpdate(req.user._id, {
    $set: { isRider: true, licenseNo, vehicleNo, vehicleType: vehicleType || "bike" }
  }, { new: true })

  console.log("✅ Rider profile updated:", user._id)
  res.status(200).json({ success: true, data: { user } })
}))

router.post("/", auth, wrap(async (req, res) => {
  const {
    riderName, riderPhone,
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
    collegeId: null,
    riderId: req.user._id,
    riderName: riderName || req.user.firstName || "Rider",
    riderPhone: riderPhone || req.user.phone || "",
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
// HISTORY ROUTE
// ─────────────────────────────────────────────────────────────
router.get("/history", auth, wrap(async (req, res) => {
  const { passengerId, riderId } = req.query

  if (!passengerId && !riderId) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_PARAMS", message: "passengerId or riderId required" }
    })
  }

  const query = passengerId ? { "passenger.userId": passengerId } : { riderId }

  const rides = await Ride.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
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
    io.to(`ride:${ride._id}`).emit("ride:cancelled_by_rider", { riderName: ride.riderName || "The rider" })
  }

  // Mark as cancelled
  await Ride.findByIdAndUpdate(ride._id, { $set: { status: "cancelled" } })

  // Remove from all passengers' discovery lists
  const room = io.sockets.adapter.rooms.get("riders-watch")
  console.log(`Ride ${ride._id} cancelled — notifying ${room?.size || 0} passengers in riders-watch`)
  io.to("riders-watch").emit("ride:removed", { rideId: String(ride._id) })
  res.json({ success: true })
}))

router.post("/:id/pickup-start", auth, wrap(async (req, res) => {
  const ride = await rideService.startPickup(req.params.id, req.user._id)
  io.to(`ride:${ride._id}`).emit("ride:pickup_started", { rideId: String(ride._id) })
  res.json({ success: true, data: { ride } })
}))

router.post("/:id/arrive", auth, wrap(async (req, res) => {
  const ride = await rideService.arriveAtPickup(req.params.id, req.user._id)
  io.to(`ride:${ride._id}`).emit("ride:arrived", { rideId: String(ride._id) })
  res.json({ success: true, data: { ride } })
}))

router.post("/:id/start", auth, wrap(async (req, res) => {
  const ride = await rideService.startRide(req.params.id, req.user._id, req.body.otp)
  io.to(`ride:${ride._id}`).emit("ride:started", { rideId: String(ride._id) })
  res.json({ success: true, data: { ride } })
}))

router.post("/:id/reached", auth, wrap(async (req, res) => {
  const ride = await rideService.reachDestination(req.params.id, req.user._id)
  io.to(`ride:${ride._id}`).emit("ride:reached_destination", { rideId: String(ride._id) })
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
      code: err.code || "SERVER_ERROR",
      message: err.message || "Something went wrong",
    },
  })
})

export default router
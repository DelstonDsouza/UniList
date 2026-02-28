// server/routes/ride.routes.js

import express from "express"
import Ride from "../models/Ride.js"
import * as rideService from "../services/ride.service.js"
import auth from "../middleware/auth.js"
import requireVerified from "../middleware/requireVerified.js"

const router = express.Router()

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// ─────────────────────────────────────────────────────────────
// PASSENGER ROUTES
// ─────────────────────────────────────────────────────────────

router.get("/nearby", auth, wrap(async (req, res) => {
  const { lat, lng } = req.query
  const collegeId = req.user.universityId

  console.log("nearby req.user:", JSON.stringify(req.user))
  console.log("lat:", lat, "lng:", lng)

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_COORDS", message: "lat and lng query params required" },
    })
  }

  const rides = await rideService.getNearbyRides(
    parseFloat(lat), parseFloat(lng), collegeId
  )
  res.json({ success: true, data: { rides } })
}))

router.post("/:id/request", auth, requireVerified, wrap(async (req, res) => {
  const { passengerLat, passengerLng, name, phone } = req.body
  const rideId    = req.params.id
  const collegeId = req.user.universityId

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
    collegeId
  )

  res.json({ success: true, data: { ride } })
}))

router.get("/active", auth, requireVerified, wrap(async (req, res) => {
  const ride = await rideService.getPassengerActiveRide(req.user._id)
  res.json({ success: true, data: { ride } })
}))

// ─────────────────────────────────────────────────────────────
// RIDER ROUTES
// ─────────────────────────────────────────────────────────────

router.post("/", auth, requireVerified, wrap(async (req, res) => {
  const { riderName, riderPhone, scooterNumber, pickupLat, pickupLng, currentLat, currentLng } = req.body

  if (!pickupLat || !pickupLng || !currentLat || !currentLng) {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_COORDS", message: "Location coordinates required" },
    })
  }

  const existing = await Ride.findOne({
    riderId: req.user._id,
    status: { $in: ["pending", "locked", "ongoing"] },
  })
  if (existing) {
    return res.status(400).json({
      success: false,
      error: { code: "ACTIVE_RIDE_EXISTS", message: "Complete your current ride before posting a new one" },
    })
  }

  const ride = await Ride.create({
    collegeId:    req.user.universityId,
    riderId:      req.user._id,
    riderName:    riderName  || req.user.firstName,
    riderPhone:   riderPhone || req.user.phone,
    scooterNumber,
    currentLocation: { type: "Point", coordinates: [parseFloat(currentLng), parseFloat(currentLat)] },
    pickupLocation:  { type: "Point", coordinates: [parseFloat(pickupLng),   parseFloat(pickupLat)]  },
    status: "pending",
  })

  res.status(201).json({ success: true, data: { ride } })
}))

router.get("/my", auth, wrap(async (req, res) => {
  const rides = await Ride.find({ riderId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()
  res.json({ success: true, data: { rides } })
}))

router.post("/:id/start", auth, requireVerified, wrap(async (req, res) => {
  const ride = await rideService.startRide(req.params.id, req.user._id)
  res.json({ success: true, data: { ride } })
}))

router.post("/:id/complete", auth, requireVerified, wrap(async (req, res) => {
  const ride = await rideService.completeRide(req.params.id, req.user._id, req.body.paymentMethod)
  res.json({ success: true, data: { ride } })
}))

router.post("/:id/reject-passenger", auth, requireVerified, wrap(async (req, res) => {
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
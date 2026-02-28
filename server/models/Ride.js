// server/models/Ride.js
// REPLACE your existing Ride.js

import mongoose from "mongoose"

const GeoPointSchema = new mongoose.Schema(
  {
    type:        { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },  // [lng, lat]
  },
  { _id: false }
)

const PassengerSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name:     { type: String, default: null },
    phone:    { type: String, default: null },
    location: { type: GeoPointSchema, default: null },
  },
  { _id: false }
)

const FareSchema = new mongoose.Schema(
  {
    distanceKm:   { type: Number },
    amount:       { type: Number },
    calculatedAt: { type: Date },
  },
  { _id: false }
)

const RideSchema = new mongoose.Schema(
  {
    // Multi-tenancy
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },

    // Rider
    riderId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    riderName:    { type: String, required: true, trim: true },
    riderPhone:   { type: String, required: true, trim: true },
    scooterNumber:{ type: String, required: true, trim: true },

    // Geo — GeoJSON, coordinates = [lng, lat]
    currentLocation: { type: GeoPointSchema, required: true },  // rider live position
    pickupLocation:  { type: GeoPointSchema, required: true },  // where rider picks up

    // State machine
    status: {
      type: String,
      enum: ["pending", "locked", "ongoing", "completed", "rejected"],
      default: "pending",
    },

    // Passenger slot — null until someone requests
    passenger: { type: PassengerSchema, default: null },

    // Fare — null until locked (never exposed before lock)
    fare: { type: FareSchema, default: null },

    // Payment
    payment: {
      method:        { type: String, enum: ["cash", "razorpay", null], default: null },
      status:        { type: String, enum: ["pending", "paid"], default: "pending" },
      transactionId: { type: String, default: null },
    },

    // Timestamps
    lockedAt:    { type: Date, default: null },
    startedAt:   { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// ── CRITICAL: 2dsphere indexes enable the $nearSphere 3 km filter ──
RideSchema.index({ currentLocation: "2dsphere" })
RideSchema.index({ pickupLocation: "2dsphere" })
RideSchema.index({ "passenger.location": "2dsphere" })
RideSchema.index({ collegeId: 1, status: 1 })
RideSchema.index({ riderId: 1, status: 1 })

export default mongoose.model("Ride", RideSchema)
// server/models/Ride.js

import mongoose from "mongoose"

const GeoPointSchema = new mongoose.Schema(
  {
    type:        { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
)

const PassengerSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name:     { type: String, default: "" },
    phone:    { type: String, default: "" },
    location: { type: GeoPointSchema, default: null },
  },
  { _id: false }
)

const FareSchema = new mongoose.Schema(
  {
    distanceKm:   { type: Number, default: 0 },
    amount:       { type: Number, default: 0 },
    calculatedAt: { type: Date, default: null },
  },
  { _id: false }
)

const RideSchema = new mongoose.Schema(
  {
    // Rider info
    riderId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    riderName:     { type: String, default: "", trim: true },
    riderPhone:    { type: String, default: "", trim: true },
    scooterNumber: { type: String, default: "N/A", trim: true },

    // Locations (GeoJSON — coordinates = [lng, lat])
    currentLocation: { type: GeoPointSchema, required: true },
    pickupLocation:  { type: GeoPointSchema, required: true },

    // College destination
    collegeDestination: {
      name: { type: String, default: "" },
      lat:  { type: Number, default: null },
      lng:  { type: Number, default: null },
    },

    // Departure time
    departureTime:    { type: String, default: "" },  // "HH:mm" 24h format
    departureTimeStr: { type: String, default: "" },  // "10:30 AM" display format

    // State machine
    status: {
      type: String,
      enum: ["pending", "locked", "ongoing", "completed", "cancelled"],
      default: "pending",
    },

    // Passenger — null until someone requests
    passenger: { type: PassengerSchema, default: null },

    // Fare — null until locked
    fare: { type: FareSchema, default: null },

    // Payment
    payment: {
      method: { type: String, enum: ["cash", "upi", null], default: null },
      status: { type: String, enum: ["pending", "paid"], default: "pending" },
    },

    // Timestamps
    lockedAt:    { type: Date, default: null },
    startedAt:   { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// 2dsphere indexes for geo queries
RideSchema.index({ currentLocation: "2dsphere" })
RideSchema.index({ pickupLocation: "2dsphere" })
RideSchema.index({ riderId: 1, status: 1 })
RideSchema.index({ status: 1 })

export default mongoose.model("Ride", RideSchema)
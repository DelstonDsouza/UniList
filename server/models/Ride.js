// server/models/Ride.js

import mongoose from "mongoose"

const GeoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
)

const PassengerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    location: { type: GeoPointSchema, default: null },
    pickupAddress: { type: String, default: "" },
  },
  { _id: false }
)

const FareSchema = new mongoose.Schema(
  {
    distanceKm: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    calculatedAt: { type: Date, default: null },
  },
  { _id: false }
)

const RideSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    riderName: { type: String, default: "", trim: true },
    riderPhone: { type: String, default: "", trim: true },
    scooterNumber: { type: String, default: "N/A", trim: true },

    currentLocation: { type: GeoPointSchema, required: true },
    pickupLocation: { type: GeoPointSchema, required: true },

    collegeDestination: {
      name: { type: String, default: "" },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    pickupAddress: { type: String, default: "" },

    departureTime: { type: String, default: "" },
    departureTimeStr: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "locked", "pickup_started", "ongoing", "reached_destination", "completed", "cancelled"],
      default: "pending",
    },

    passenger: { type: PassengerSchema, default: null },
    fare: { type: FareSchema, default: null },

    payment: {
      method: { type: String, enum: ["cash", "upi", null], default: null },
      status: { type: String, enum: ["pending", "paid"], default: "pending" },
    },

    lockedAt: { type: Date, default: null },
    otp: { type: String, default: null },
    startedAt: { type: Date, default: null },
    reachedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Reviews
    riderReview: {
      rating: { type: Number, min: 1, max: 5, default: null },
      text: { type: String, default: "" },
      givenAt: { type: Date, default: null },
    },
    passengerReview: {
      rating: { type: Number, min: 1, max: 5, default: null },
      text: { type: String, default: "" },
      givenAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
)

RideSchema.index({ currentLocation: "2dsphere" })
RideSchema.index({ pickupLocation: "2dsphere" })
RideSchema.index({ riderId: 1, status: 1 })
RideSchema.index({ status: 1 })

export default mongoose.model("Ride", RideSchema)
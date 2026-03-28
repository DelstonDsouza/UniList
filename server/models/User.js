// server/models/User.js

import mongoose from "mongoose"

const UserSchema = new mongoose.Schema(
  {
    // Firebase Auth
    firebaseUid: { type: String, required: true, unique: true },

    // Profile
    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
    universityId: { type: String, default: "", trim: true },
    profilePic: { type: String, default: "" },

    // Role
    role: { type: String, enum: ["student", "admin"], default: "student" },
    isRider: { type: Boolean, default: false },
    licenseNo: { type: String, default: "", trim: true },
    vehicleNo: { type: String, default: "", trim: true },

    // Active ride tracking
    activeRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
    },

    // Ratings (as rider)
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // Ratings (as passenger)
    passengerRatingSum: { type: Number, default: 0 },
    passengerRatingCount: { type: Number, default: 0 },

  },
  { timestamps: true }
)

UserSchema.virtual("avgRating").get(function () {
  return this.ratingCount > 0
    ? (this.ratingSum / this.ratingCount).toFixed(1)
    : null
})

UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim()
})

export default mongoose.model("User", UserSchema)
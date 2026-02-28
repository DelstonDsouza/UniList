// server/models/User.js

import mongoose from "mongoose"
import bcrypt from "bcryptjs"

const UserSchema = new mongoose.Schema(
  {
    // Multi-tenancy
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null },

    // Profile
    firstName:    { type: String, default: "User", trim: true },
    lastName:     { type: String, default: "", trim: true },
    email:        { type: String, sparse: true, lowercase: true, trim: true },
    phone:        { type: String, default: "", trim: true },
    gender:       { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
    universityId: { type: String, default: "pending", trim: true },

    // Auth
    passwordHash: { type: String, default: "firebase-auth" },

    // Firebase Auth
    firebaseUid: { type: String, default: null, sparse: true },

    // Verification (admin sets this)
    collegeIdPhotoUrl: { type: String, default: null },
    verified:          { type: Boolean, default: false },

    // Role
    role:    { type: String, enum: ["student", "admin"], default: "student" },
    isRider: { type: Boolean, default: false },

    // Active ride tracking
    activeRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
    },

    // Rating
    ratingSum:   { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

UserSchema.index({ collegeId: 1 })
UserSchema.index({ firebaseUid: 1 }, { sparse: true })

// Password helpers
UserSchema.methods.setPassword = async function (plaintext) {
  this.passwordHash = await bcrypt.hash(plaintext, 12)
}
UserSchema.methods.checkPassword = async function (plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash)
}

UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

export default mongoose.model("User", UserSchema)
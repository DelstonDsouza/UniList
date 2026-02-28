// server/models/College.js
// CREATE this new file
// Stores the college's GPS coordinates — used for fare calculation

import mongoose from "mongoose"

const CollegeSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true },
    slug:    { type: String, required: true, unique: true },  // e.g. "sjec"
    location: {
      type:        { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },  // [lng, lat]
    },
    address: { type: String },
    domain:  { type: String },  // e.g. "sjec.ac.in"
  },
  { timestamps: true }
)

CollegeSchema.index({ location: "2dsphere" })

export default mongoose.model("College", CollegeSchema)
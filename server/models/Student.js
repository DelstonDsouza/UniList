// server/models/Student.js
// Pre-loaded college student records — used to verify and auto-fill registration

import mongoose from "mongoose"

const StudentSchema = new mongoose.Schema(
  {
    universityId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    firstName:    { type: String, required: true, trim: true },
    lastName:     { type: String, required: true, trim: true },
    gender:       { type: String, enum: ["Male", "Female", "Other"], required: true },
    isRegistered: { type: Boolean, default: false }, // true once a user claims this ID
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

export default mongoose.model("Student", StudentSchema)
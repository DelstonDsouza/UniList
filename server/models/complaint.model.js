import mongoose from "mongoose"

const complaintSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    complaintType: {
      type: String,
      enum: ["Past Ride Related", "Pricing & Refund Related", "Technical Related", "Other Related"],
      required: true,
    },
    complaint: { type: String, required: true },
    against: { type: String },
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride" },
    attachment: { type: String }, // Base64 string for images
    adminResponse: { type: String }, // Added for admin reply
    status: {
      type: String,
      enum: ["pending", "in_review", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true }
)

export const Complaint = mongoose.model("Complaint", complaintSchema)

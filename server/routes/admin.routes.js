import { Router } from "express"
import mongoose from "mongoose"
import User from "../models/User.js"
import auth from "../middleware/auth.js"
import { io } from "../index.js"

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const router = Router()

// GET /api/admin/users
// Fetch all users for the admin dashboard
router.get("/users", wrap(async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 })

  // Format the response to map Mongoose _id to uid that frontend expects
  const formattedUsers = users.map(user => ({
    uid: user.firebaseUid || user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    universityId: user.universityId,
    verified: true, // Mocking verified status since there's no DB fields for it yet
    isRider: user.isRider,
    role: user.role,
    collegeIdPhotoUrl: user.profilePic || null,
    isDisabled: user.isDisabled || false
  }))

  res.json({ users: formattedUsers })
}))

import Ride from "../models/Ride.js"

// GET /api/admin/rides
// Fetch all rides for the admin dashboard
router.get("/rides", wrap(async (req, res) => {
  const rides = await Ride.find({}).sort({ createdAt: -1 })
  res.json({ rides })
}))

import { Complaint } from "../models/complaint.model.js"

// GET /api/admin/complaints
// Fetch all complaints for the admin dashboard
router.get("/complaints", wrap(async (req, res) => {
  const complaints = await Complaint.find({})
    .populate("userId", "firstName lastName email phone")
    .sort({ createdAt: -1 })
  res.json({ complaints })
}))
// PUT /api/admin/complaints/:id
// Admin responds to a complaint
router.put("/complaints/:id", wrap(async (req, res) => {
  const { adminResponse, status } = req.body
  
  if (!adminResponse) {
    return res.status(400).json({ detail: "Response text is required" })
  }

  const updated = await Complaint.findByIdAndUpdate(
    req.params.id,
    { 
      adminResponse,
      status: status || "resolved" // default to resolved if not specified
    },
    { new: true }
  ).populate("userId", "firstName lastName email phone")

  if (!updated) {
    return res.status(404).json({ detail: "Complaint not found" })
  }

  res.json({ detail: "Complaint updated successfully", complaint: updated })
}))

// GET /api/debug/users
// Fallback debug users route that the frontend tries if admin/users fails
router.get("/debug/users", wrap(async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 })
  res.json({ users })
}))

// PUT /api/admin/users/:id/disable
// Admin disables or enables a user account
router.put("/users/:id/disable", auth, wrap(async (req, res) => {
  const { isDisabled } = req.body
  const userId = req.params.id

  // If trying to disable, check if user is in an active ride
  if (isDisabled) {
    let query = mongoose.Types.ObjectId.isValid(userId) ? { _id: userId } : { firebaseUid: userId }
    const targetUser = await User.findOne(query)
    if (!targetUser) return res.status(404).json({ error: { message: "User not found" } })

    const activeRide = await Ride.findOne({
      $or: [
        { riderId: targetUser._id, status: { $in: ["pending", "locked", "pickup_started", "ongoing"] } },
        { "passenger.userId": targetUser._id, status: { $in: ["locked", "pickup_started", "ongoing"] } }
      ]
    })
    
    if (activeRide) {
      return res.status(400).json({ error: { message: "User cannot be disabled during an active ride." } })
    }
  }

  // Update user status
  let query = mongoose.Types.ObjectId.isValid(userId) ? { _id: userId } : { firebaseUid: userId }
  
  const user = await User.findOneAndUpdate(
    query,
    { $set: { isDisabled } },
    { new: true }
  )

  if (!user) {
    return res.status(404).json({ error: { message: "User not found" } })
  }

  res.json({ success: true, user })
  
  // Real-time notification to the specific user room
  io.to(`user:${user._id}`).emit("user:disabled_state", { isDisabled: user.isDisabled })
  io.to(`user:${user.firebaseUid}`).emit("user:disabled_state", { isDisabled: user.isDisabled })
}))

export default router

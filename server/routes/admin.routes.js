import { Router } from "express"
import User from "../models/User.js"

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
    collegeIdPhotoUrl: user.profilePic || null
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

// GET /api/debug/users
// Fallback debug users route that the frontend tries if admin/users fails
router.get("/debug/users", wrap(async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 })
  res.json({ users })
}))

export default router

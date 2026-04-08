// server/routes/auth.routes.js

import { Router } from "express"
import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../config/env.js"
import User from "../models/User.js"
import Student from "../models/Student.js"
import Ride from "../models/Ride.js"
import firebaseAdmin from "../config/firebaseAdmin.js"
import { isDBReady, mem } from "../config/db.js"

const router = Router()

// ── POST /api/auth/firebase ──────────────────────────────────────────────────
router.post("/firebase", async (req, res) => {
  try {
    const { idToken } = req.body
    if (!idToken) return res.status(400).json({ detail: "Missing idToken" })

    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken)

    let user;
    if (!isDBReady()) {
      // In-memory fallback
      console.log("⚠️ DB not ready, using memory fallback for auth")
      const existingMemUser = [...mem.users.values()].find(u => u.firebaseUid === decoded.uid)
      if (existingMemUser) {
        user = existingMemUser
      } else {
        user = {
          _id: "mem:" + Date.now(),
          firebaseUid: decoded.uid,
          phone: decoded.phone_number || "",
          firstName: "", lastName: "", email: "", gender: "", universityId: "",
          isRider: false, role: "student"
        }
        mem.users.set(String(user._id), user)
      }
    } else {
      console.log(`🔑 Firebase Auth success for [${decoded.phone_number}] (UID: ${decoded.uid})`)
      
      const student = await Student.findOne({ 
        phone: decoded.phone_number?.replace(/\D/g, "").slice(-10) || "" 
      })

      if (student) {
        console.log(`🎓 Matched student [${student.universityId}] for ${decoded.phone_number}`)
      }

      user = await User.findOneAndUpdate(
        { firebaseUid: decoded.uid },
        {
          $set: { phone: decoded.phone_number || "" },
          $setOnInsert: {
            firebaseUid:  decoded.uid,
            firstName:    student?.firstName || "",
            lastName:     student?.lastName  || "",
            gender:       student?.gender    || "",
            universityId: student?.universityId || "",
            isRider:      false,
            role:         "student",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
      
      if (student && !student.isRegistered) {
        console.log(`🔗 Linking student [${student.universityId}] to User [${user._id}]`)
        await Student.findByIdAndUpdate(student._id, {
          $set: { isRegistered: true, registeredBy: user._id }
        })
      }
    }



    const token = jwt.sign({ uid: String(user._id) }, JWT_SECRET, { expiresIn: "7d" })

    // Tell frontend what step to show next
    const profileComplete = !!(user.firstName && user.universityId && user.gender)
    const roleSelected    = !!(user.firstName) // role is selected after profile

    return res.json({
      token,
      userId:          String(user._id),
      profileComplete,
      roleSelected,
      role:            user.isRider ? "rider" : "passenger",
      isDisabled:      user.isDisabled || false,
    })

  } catch (err) {
    console.error("Firebase auth error:", err)
    return res.status(401).json({ detail: "Invalid Firebase token" })
  }
})

// ── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put("/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ detail: "Missing token" })

    const decoded = jwt.verify(token, JWT_SECRET)
    const { firstName, lastName, email, gender, universityId, isRider, profilePic } = req.body

    // If universityId is being set, mark student as registered
    if (universityId) {
      const existing = await User.findOne({
        universityId,
        _id: { $ne: decoded.uid }
      })
      if (existing) {
        return res.status(409).json({ detail: "This University ID is already registered" })
      }

      await Student.findOneAndUpdate(
        { universityId: universityId.toUpperCase() },
        { $set: { isRegistered: true, registeredBy: decoded.uid } }
      )
    }

    const user = await User.findByIdAndUpdate(
      decoded.uid,
      {
        $set: {
          ...(firstName    !== undefined && { firstName }),
          ...(lastName     !== undefined && { lastName }),
          ...(email        !== undefined && { email }),
          ...(gender       !== undefined && { gender }),
          ...(universityId !== undefined && { universityId }),
          ...(isRider      !== undefined && { isRider }),
          ...(profilePic   !== undefined && { profilePic }),
        },
      },
      { new: true }
    )

    if (!user) return res.status(404).json({ detail: "User not found" })
    return res.json({ ok: true })

  } catch (err) {
    console.error("Profile update error:", err)
    return res.status(500).json({ detail: "Server error" })
  }
})

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ detail: "Missing token" })

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.uid)
    if (!user) return res.status(404).json({ detail: "User not found" })

    let totalEarnings = 0 // for riders
    let totalSpent = 0    // for passengers
    let totalRides = 0

    if (user.isRider) {
      const stats = await Ride.aggregate([
        { $match: { riderId: user._id, status: "completed" } },
        { $group: { _id: null, totalEarnings: { $sum: "$fare.amount" }, count: { $sum: 1 } } }
      ])
      if (stats.length > 0) {
        totalEarnings = stats[0].totalEarnings
        totalRides = stats[0].count
      }
    } else {
      // Passenger stats
      const stats = await Ride.aggregate([
        { $match: { "passenger.userId": user._id, status: "completed" } },
        { $group: { _id: null, totalSpent: { $sum: "$fare.amount" }, count: { $sum: 1 } } }
      ])
      if (stats.length > 0) {
        totalSpent = stats[0].totalSpent
        totalRides = stats[0].count
      }
    }

    return res.json({
      user: {
        _id:          String(user._id),
        uid:          String(user._id),
        firebaseUid:  user.firebaseUid,
        firstName:    user.firstName,
        lastName:     user.lastName,
        phone:        user.phone,
        email:        user.email,
        gender:       user.gender,
        universityId: user.universityId,
        profilePic:   user.profilePic,
        isRider:      user.isRider,
        role:         user.role,
        rating:       user.isRider
                        ? (user.ratingCount > 0 ? (user.ratingSum/user.ratingCount).toFixed(1) : null)
                        : (user.passengerRatingCount > 0 ? (user.passengerRatingSum/user.passengerRatingCount).toFixed(1) : null),
        totalEarnings,
        totalSpent,
        totalRides,
        isDisabled:   user.isDisabled || false,
      }
    })
  } catch {
    return res.status(401).json({ detail: "Invalid token" })
  }
})

export default router
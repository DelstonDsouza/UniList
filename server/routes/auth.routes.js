import { Router } from "express"
import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../config/env.js"
import { isDBReady, mem } from "../config/db.js"
import User from "../models/User.js"

const router = Router()

// ── POST /api/auth/firebase ──────────────────────────────────────────────────
// Verifies Firebase phone OTP token → finds or creates MongoDB user → returns backend JWT
router.post("/firebase", async (req, res) => {
    try {
        const { idToken } = req.body
        if (!idToken) return res.status(400).json({ detail: "Missing idToken" })

        const firebaseAdmin = (await import("../config/firebaseAdmin.js")).default
        const decoded = await firebaseAdmin.auth().verifyIdToken(idToken)

        if (isDBReady()) {
            // ✅ findOneAndUpdate with upsert — avoids duplicate key errors entirely
            // Never touches the `email` field, so the sparse unique index is never triggered
            const user = await User.findOneAndUpdate(
                { firebaseUid: decoded.uid },          // filter
                {
                    $setOnInsert: {                    // only set these on first creation
                        firebaseUid: decoded.uid,
                        phone:       decoded.phone_number || "",
                        firstName:   "User",
                        lastName:    decoded.phone_number || decoded.uid.slice(0, 6),
                        verified:    false,
                        role:        "student",
                        isRider:     false,
                    },
                },
                {
                    upsert: true,                      // create if not found
                    new: true,                         // return the document
                    setDefaultsOnInsert: true,
                }
            )

            console.log("Firebase auth user:", user._id, user.phone)

            const token = jwt.sign(
                { uid: String(user._id) },
                JWT_SECRET,
                { expiresIn: "7d" }
            )
            return res.json({ token })

        } else {
            // DB not ready — use in-memory store
            let memUser = [...mem.users.values()].find(u => u.firebaseUid === decoded.uid)

            if (!memUser) {
                memUser = {
                    _id:         `mem:${decoded.uid}`,
                    firebaseUid: decoded.uid,
                    phone:       decoded.phone_number || "",
                    firstName:   "User",
                    lastName:    decoded.phone_number || decoded.uid.slice(0, 6),
                    isRider:     false,
                    verified:    false,
                    createdAt:   new Date(),
                }
                mem.users.set(memUser._id, memUser)
            }

            const token = jwt.sign(
                { uid: String(memUser._id) },
                JWT_SECRET,
                { expiresIn: "7d" }
            )
            return res.json({ token, mode: "mem" })
        }

    } catch (err) {
        console.error("Firebase verify error:", err)
        return res.status(401).json({ detail: "Invalid Firebase token" })
    }
})

// ── GET /api/auth/users/me ───────────────────────────────────────────────────
router.get("/users/me", async (req, res) => {
    try {
        const authHeader = req.headers.authorization || ""
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
        if (!token) return res.status(401).json({ detail: "Missing token" })

        const decoded = jwt.verify(token, JWT_SECRET)

        if (!isDBReady() || String(decoded.uid).startsWith("mem:")) {
            const memUser = [...mem.users.values()].find(u => String(u._id) === decoded.uid)
            if (!memUser) return res.json({ user: null })
            return res.json({
                user: {
                    uid:       String(memUser._id),
                    phone:     memUser.phone,
                    firstName: memUser.firstName,
                    lastName:  memUser.lastName,
                    isRider:   !!memUser.isRider,
                    verified:  !!memUser.verified,
                    createdAt: memUser.createdAt?.toISOString() || null,
                },
            })
        } else {
            const user = await User.findById(decoded.uid)
            if (!user) return res.json({ user: null })
            return res.json({
                user: {
                    uid:          String(user._id),
                    phone:        user.phone,
                    firstName:    user.firstName,
                    lastName:     user.lastName,
                    universityId: user.universityId,
                    isRider:      !!user.isRider,
                    verified:     !!user.verified,
                    createdAt:    user.createdAt?.toISOString() || null,
                },
            })
        }
    } catch (err) {
        console.error("Users/me error:", err?.message || err)
        return res.status(401).json({ detail: "Invalid token" })
    }
})

export default router
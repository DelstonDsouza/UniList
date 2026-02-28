import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../config/env.js"
import { isDBReady, mem } from "../config/db.js"
import User from "../models/User.js"

export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ detail: "Missing token" })
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    let user = null
if (!isDBReady() || String(decoded.uid).startsWith("mem:")) {
  // In-memory mode — look up by _id, not email
  const memUser = [...mem.users.values()].find(u => String(u._id) === decoded.uid)
  if (memUser) {
    user = {
      ...memUser,
      uid: String(memUser._id),
      _id: String(memUser._id),
    }
  }
} else {
      // MongoDB mode
      const dbUser = await User.findById(decoded.uid).lean()
      if (dbUser) {
        user = {
          ...dbUser,
          uid: String(dbUser._id),
          _id: String(dbUser._id),
        }
      }
    }

    if (!user) {
      return res.status(401).json({ detail: "User not found" })
    }

    req.user = user  // now has: uid, _id, email, verified, universityId, isRider, etc.
    next()

  } catch (err) {
    return res.status(401).json({ detail: "Invalid or expired token" })
  }
}
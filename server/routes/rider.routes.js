import { Router } from "express"
import { isDBReady, mem } from "../config/db.js"
import Ride from "../models/Ride.js"
import auth from "../middleware/auth.js"

const router = Router()

// ── GET /api/rider/ride-offers ───────────────────────────────────────────────
router.get("/ride-offers", auth, async (req, res) => {
    try {
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const offers = mem.rides
                .filter(r => r.riderUid === req.user.uid && (r.status || "pending") !== "cancelled")
                .sort((a, b) => b.createdAt - a.createdAt)
            return res.json({ offers })
        } else {
            const offers = await Ride.find({ riderUid: req.user.uid, status: { $ne: "cancelled" } })
                .sort({ createdAt: -1 }).lean()
            return res.json({ offers })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

export default router

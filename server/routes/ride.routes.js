import { Router } from "express"
import { isDBReady, mem } from "../config/db.js"
import Ride from "../models/Ride.js"
import User from "../models/User.js"
import auth from "../middleware/auth.js"
import { nextId } from "../utils/helpers.js"

const router = Router()

// ── GET /api/ride-offers ─────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
    try {
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const offers = mem.rides.filter(r => r.riderUid !== req.user.uid && (r.status || "pending") === "pending")
            return res.json({ offers })
        } else {
            const offers = await Ride.find({ riderUid: { $ne: req.user.uid }, status: "pending" }).sort({ createdAt: -1 }).lean()
            return res.json({ offers })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── GET /api/ride-offers/:id ─────────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
    try {
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const ride = mem.rides.find(r => r.id === req.params.id)
            if (!ride) return res.status(404).json({ detail: "Not found" })
            return res.json({ offer: ride })
        } else {
            let ride = await Ride.findOne({ id: req.params.id }).lean()
            if (!ride) {
                try {
                    ride = await Ride.findById(req.params.id).lean()
                } catch { }
            }
            if (!ride) return res.status(404).json({ detail: "Not found" })
            return res.json({ offer: ride })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── POST /api/ride-offers ────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
    try {
        const { destination, departureTime, pickupLater, pickupLat, pickupLng, currentLat, currentLng } = req.body || {}
        if (!destination || !departureTime) return res.status(400).json({ detail: "Missing destination or time" })

        let riderName = null
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const u = mem.users.get(req.user.email)
            riderName = u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : ""
            const ride = {
                id: nextId(),
                riderUid: req.user.uid,
                riderName,
                destination,
                departureTime,
                pickupLater: !!pickupLater,
                pickupLat: typeof pickupLat === "number" ? pickupLat : null,
                pickupLng: typeof pickupLng === "number" ? pickupLng : null,
                currentLat: typeof currentLat === "number" ? currentLat : null,
                currentLng: typeof currentLng === "number" ? currentLng : null,
                status: "pending",
                createdAt: new Date(),
            }
            mem.rides.push(ride)
            return res.json({ offer: ride })
        } else {
            const u = await User.findById(req.user.uid)
            riderName = u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : ""
            const ride = await Ride.create({
                id: nextId(),
                riderUid: req.user.uid,
                riderName,
                destination,
                departureTime,
                pickupLater: !!pickupLater,
                pickupLat: typeof pickupLat === "number" ? pickupLat : null,
                pickupLng: typeof pickupLng === "number" ? pickupLng : null,
                currentLat: typeof currentLat === "number" ? currentLat : null,
                currentLng: typeof currentLng === "number" ? currentLng : null,
                status: "pending",
            })
            return res.json({ offer: ride })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── POST /api/ride-offers/:id/accept ─────────────────────────────────────────
router.post("/:id/accept", auth, async (req, res) => {
    try {
        const { passengerName, passengerPhone, passengerLat, passengerLng } = req.body || {}
        if (!passengerName || !passengerPhone) return res.status(400).json({ detail: "Missing passenger details" })

        const applyAccept = (r) => {
            if (!r) return null
            if (r.riderUid === req.user.uid) return "own_ride"
            if ((r.status || "pending") !== "pending") return "finalized"
            r.passengerUid = req.user.uid
            r.passengerName = passengerName
            r.passengerPhone = passengerPhone
            r.passengerLat = typeof passengerLat === "number" ? passengerLat : null
            r.passengerLng = typeof passengerLng === "number" ? passengerLng : null
            r.status = "accepted"
            return r
        }

        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const ride = mem.rides.find(r => r.id === req.params.id)
            const result = applyAccept(ride)
            if (result === "own_ride") return res.status(403).json({ detail: "Cannot book own ride" })
            if (result === "finalized") return res.status(409).json({ detail: "Ride status is finalized" })
            return res.json({ offer: ride })
        } else {
            const ride = await Ride.findOne({ id: req.params.id })
            if (!ride) return res.status(404).json({ detail: "Not found" })
            const result = applyAccept(ride)
            if (result === "own_ride") return res.status(403).json({ detail: "Cannot book own ride" })
            if (result === "finalized") return res.status(409).json({ detail: "Ride status is finalized" })
            await ride.save()
            return res.json({ offer: ride })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── POST /api/ride-offers/:id/reject ─────────────────────────────────────────
router.post("/:id/reject", auth, async (req, res) => {
    try {
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const ride = mem.rides.find(r => r.id === req.params.id)
            if (!ride) return res.status(404).json({ detail: "Not found" })
            if (ride.riderUid === req.user.uid) return res.status(403).json({ detail: "Cannot reject own ride" })
            if ((ride.status || "pending") !== "pending") return res.status(409).json({ detail: "Ride status is finalized" })
            ride.status = "rejected"
            return res.json({ offer: ride })
        } else {
            const ride = await Ride.findOne({ id: req.params.id })
            if (!ride) return res.status(404).json({ detail: "Not found" })
            if (ride.riderUid === req.user.uid) return res.status(403).json({ detail: "Cannot reject own ride" })
            if ((ride.status || "pending") !== "pending") return res.status(409).json({ detail: "Ride status is finalized" })
            ride.status = "rejected"
            await ride.save()
            return res.json({ offer: ride })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── POST /api/ride-offers/:id/start ──────────────────────────────────────────
router.post("/:id/start", auth, async (req, res) => {
    try {
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const ride = mem.rides.find(r => r.id === req.params.id)
            if (!ride) return res.status(404).json({ detail: "Not found" })
            if (ride.riderUid !== req.user.uid) return res.status(403).json({ detail: "Only rider can start" })
            if ((ride.status || "pending") !== "accepted" || !ride.passengerUid) {
                return res.status(409).json({ detail: "Cannot start until passenger joins" })
            }
            ride.status = "ongoing"
            return res.json({ offer: ride })
        } else {
            const ride = await Ride.findOne({ id: req.params.id })
            if (!ride) return res.status(404).json({ detail: "Not found" })
            if (ride.riderUid !== req.user.uid) return res.status(403).json({ detail: "Only rider can start" })
            if ((ride.status || "pending") !== "accepted" || !ride.passengerUid) {
                return res.status(409).json({ detail: "Cannot start until passenger joins" })
            }
            ride.status = "ongoing"
            await ride.save()
            return res.json({ offer: ride })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── POST /api/ride-offers/:id/cancel ─────────────────────────────────────────
router.post("/:id/cancel", auth, async (req, res) => {
    try {
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const ride = mem.rides.find(r => r.id === req.params.id)
            if (!ride) return res.status(404).json({ detail: "Not found" })
            if (ride.riderUid !== req.user.uid) return res.status(403).json({ detail: "Only rider can cancel" })
            ride.status = "cancelled"
            return res.json({ offer: ride })
        } else {
            const ride = await Ride.findOne({ id: req.params.id })
            if (!ride) return res.status(404).json({ detail: "Not found" })
            if (ride.riderUid !== req.user.uid) return res.status(403).json({ detail: "Only rider can cancel" })
            ride.status = "cancelled"
            await ride.save()
            return res.json({ offer: ride })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── POST /api/ride-offers/:id/complete ───────────────────────────────────────
router.post("/:id/complete", auth, async (req, res) => {
    try {
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const ride = mem.rides.find(r => r.id === req.params.id)
            if (!ride) return res.status(404).json({ detail: "Not found" })
            if (ride.riderUid !== req.user.uid) return res.status(403).json({ detail: "Only rider can complete" })
            ride.status = "completed"
            return res.json({ offer: ride })
        } else {
            const ride = await Ride.findOne({ id: req.params.id })
            if (!ride) return res.status(404).json({ detail: "Not found" })
            if (ride.riderUid !== req.user.uid) return res.status(403).json({ detail: "Only rider can complete" })
            ride.status = "completed"
            await ride.save()
            return res.json({ offer: ride })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── PATCH /api/ride-offers/:id ───────────────────────────────────────────────
router.patch("/:id", auth, async (req, res) => {
    try {
        const updates = req.body || {}
        const apply = (ride) => {
            if (!ride) return "not_found"
            if (ride.riderUid !== req.user.uid) return "forbidden"
            if ((ride.status || "pending") !== "pending") return "finalized"
            const fields = ["destination", "departureTime", "pickupLater", "pickupLat", "pickupLng", "currentLat", "currentLng"]
            fields.forEach((f) => {
                if (f in updates) {
                    const v = updates[f]
                    ride[f] = typeof v === "number" ? v : v
                }
            })
            return ride
        }

        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const ride = mem.rides.find(r => r.id === req.params.id)
            const result = apply(ride)
            if (result === "not_found") return res.status(404).json({ detail: "Not found" })
            if (result === "forbidden") return res.status(403).json({ detail: "Only rider can edit" })
            if (result === "finalized") return res.status(409).json({ detail: "Cannot edit after acceptance" })
            return res.json({ offer: ride })
        } else {
            const ride = await Ride.findOne({ id: req.params.id })
            const result = apply(ride)
            if (result === "not_found") return res.status(404).json({ detail: "Not found" })
            if (result === "forbidden") return res.status(403).json({ detail: "Only rider can edit" })
            if (result === "finalized") return res.status(409).json({ detail: "Cannot edit after acceptance" })
            await ride.save()
            return res.json({ offer: ride })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

export default router


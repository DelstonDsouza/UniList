import express from "express"
import Ride from "../models/Ride.js"
import auth from "../middleware/auth.js"

const router = express.Router()

// GET ride by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" })
    res.json({ success: true, data: { ride } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router

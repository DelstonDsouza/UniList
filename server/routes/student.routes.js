// server/routes/student.routes.js

import { Router } from "express"
import Student from "../models/Student.js"
import auth from "../middleware/auth.js"

const router = Router()

// GET /api/students/:universityId
// Returns student details if found and not already registered
router.get("/:universityId", auth, async (req, res) => {
  try {
    const uid = req.params.universityId.trim().toUpperCase()
    const student = await Student.findOne({ universityId: uid })

    if (!student) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "University ID not found in our records" },
      })
    }

    if (student.isRegistered && String(student.registeredBy) !== String(req.user._id)) {
      return res.status(409).json({
        success: false,
        error: { code: "ALREADY_REGISTERED", message: "This University ID is already registered" },
      })
    }

    return res.json({
      success: true,
      data: {
        universityId: student.universityId,
        firstName:    student.firstName,
        lastName:     student.lastName,
        gender:       student.gender,
        isRegistered: student.isRegistered,
      },
    })
  } catch (err) {
    console.error("Student lookup error:", err)
    return res.status(500).json({ success: false, error: { message: "Server error" } })
  }
})

export default router
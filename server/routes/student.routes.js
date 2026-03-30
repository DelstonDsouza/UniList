// server/routes/student.routes.js

import { Router } from "express"
import Student from "../models/Student.js"
import auth from "../middleware/auth.js"

const router = Router()

// GET /api/students/:universityId (PUBLIC)
router.get("/:universityId", async (req, res) => {
  try {
    const uid = req.params.universityId.trim().toUpperCase()
    const student = await Student.findOne({ universityId: uid })

    if (!student) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "University ID not found in our records" },
      })
    }

    // We return details even if registered, so user can finish profile setup if needed.
    // The uniqueness check is handled in the profile update route.


    return res.json({
      success: true,
      data: {
        universityId: student.universityId,
        firstName:    student.firstName,
        lastName:     student.lastName,
        gender:       student.gender,
        phone:        student.phone,
        isRegistered: student.isRegistered,
      },
    })
  } catch (err) {
    console.error("Student lookup error:", err)
    return res.status(500).json({ success: false, error: { message: "Server error" } })
  }
})

export default router
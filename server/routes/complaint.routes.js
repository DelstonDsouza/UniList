import express from "express"
import auth from "../middleware/auth.js"
import { createComplaint, getUserComplaints } from "../controllers/complaint.controller.js"

const router = express.Router()

router.post("/", auth, createComplaint)
router.get("/", auth, getUserComplaints)

export default router

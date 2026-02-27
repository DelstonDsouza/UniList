import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import multer from "multer"
import path from "path"
import fs from "fs"
import { JWT_SECRET } from "../config/env.js"
import { isDBReady, mem } from "../config/db.js"
import User from "../models/User.js"
import VerificationPhoto from "../models/VerificationPhoto.js"
import auth from "../middleware/auth.js"

const router = Router()

// ── File uploads ────────────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "server_uploads")
fs.mkdirSync(uploadsDir, { recursive: true })
const upload = multer({ dest: uploadsDir })

// ── POST /api/register ──────────────────────────────────────────────────────
router.post("/register", upload.single("collegeIdPhoto"), async (req, res) => {
    try {
        const { firstName, lastName, email, phone, gender, universityId, password } = req.body
        if (!email || !password) return res.status(400).json({ detail: "Missing email or password" })

        if (!isDBReady()) {
            if (mem.users.has(email)) return res.status(409).json({ detail: "Email already registered" })
            const passwordHash = await bcrypt.hash(password, 10)
            const user = {
                _id: `mem:${email}`,
                firstName, lastName, email, phone, gender, universityId, passwordHash,
                isRider: false,
                verified: false,
                createdAt: new Date(),
            }
            mem.users.set(email, user)
            if (req.file) mem.photos.push({ userId: user._id, fileName: req.file.filename })
            return res.json({ ok: true, mode: "mem" })
        } else {
            const exists = await User.findOne({ email })
            if (exists) return res.status(409).json({ detail: "Email already registered" })
            const passwordHash = await bcrypt.hash(password, 10)
            const user = await User.create({ firstName, lastName, email, phone, gender, universityId, passwordHash, isRider: false })
            if (req.file) {
                await VerificationPhoto.create({ userId: user._id, fileName: req.file.filename })
            }
            return res.json({ ok: true })
        }
    } catch (err) {
        console.error("Register error:", err?.message || err)
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── POST /api/login ──────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) return res.status(400).json({ detail: "Missing email or password" })

        if (!isDBReady()) {
            const user = mem.users.get(email)
            if (!user) return res.status(401).json({ detail: "Invalid credentials" })
            const ok = await bcrypt.compare(password, user.passwordHash)
            if (!ok) return res.status(401).json({ detail: "Invalid credentials" })
            const token = jwt.sign({ uid: String(user._id), email: user.email }, JWT_SECRET, { expiresIn: "7d" })
            return res.json({ token, mode: "mem" })
        } else {
            const user = await User.findOne({ email })
            if (!user) return res.status(401).json({ detail: "Invalid credentials" })
            const ok = await bcrypt.compare(password, user.passwordHash)
            if (!ok) return res.status(401).json({ detail: "Invalid credentials" })
            const token = jwt.sign({ uid: String(user._id), email: user.email }, JWT_SECRET, { expiresIn: "7d" })
            return res.json({ token })
        }
    } catch (err) {
        console.error("Login error:", err?.message || err)
        return res.status(500).json({ detail: "Server error" })
    }
})

// ── GET /api/users/me ────────────────────────────────────────────────────────
router.get("/users/me", async (req, res) => {
    try {
        const authHeader = req.headers.authorization || ""
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
        if (!token) return res.status(401).json({ detail: "Missing token" })
        const decoded = jwt.verify(token, JWT_SECRET)

        if (!isDBReady() || String(decoded.uid).startsWith("mem:")) {
            const user = mem.users.get(decoded.email)
            if (!user) return res.json({ user: null })
            return res.json({
                user: {
                    uid: String(user._id),
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    universityId: user.universityId,
                    isRider: !!user.isRider,
                    verified: !!user.verified,
                    createdAt: user.createdAt?.toISOString() || null,
                },
            })
        } else {
            const user = await User.findById(decoded.uid)
            if (!user) return res.json({ user: null })
            return res.json({
                user: {
                    uid: String(user._id),
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    universityId: user.universityId,
                    isRider: !!user.isRider,
                    verified: !!user.verified,
                    createdAt: user.createdAt?.toISOString() || null,
                },
            })
        }
    } catch (err) {
        console.error("Users/me error:", err?.message || err)
        return res.status(401).json({ detail: "Invalid token" })
    }
})

// ── POST /api/users/me/rider ─────────────────────────────────────────────────
router.post("/users/me/rider", auth, async (req, res) => {
    try {
        if (!isDBReady() || String(req.user.uid).startsWith("mem:")) {
            const u = mem.users.get(req.user.email)
            if (!u) return res.status(404).json({ detail: "User not found" })
            u.isRider = true
            return res.json({ ok: true, user: { uid: u._id, isRider: true } })
        } else {
            const u = await User.findById(req.user.uid)
            if (!u) return res.status(404).json({ detail: "User not found" })
            u.isRider = true
            await u.save()
            return res.json({ ok: true, user: { uid: String(u._id), isRider: true } })
        }
    } catch (err) {
        return res.status(500).json({ detail: "Server error" })
    }
})

export default router

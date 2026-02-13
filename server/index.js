import dotenv from "dotenv"
dotenv.config()
import 'dotenv/config'
import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import multer from "multer"
import path from "path"
import fs from "fs"

const app = express()
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}))
app.options("*", cors())
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})
app.use(express.json())

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/kozhigo"
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret"
let dbReady = false
// In-memory fallback store when MongoDB is unavailable
const mem = {
  users: new Map(), // email -> user
  photos: [],
}

async function initDB() {
  try {
    await mongoose.connect(MONGO_URL, {
      serverSelectionTimeoutMS: 5000,
    })
    dbReady = true
    console.log("MongoDB connected")
  } catch (err) {
    dbReady = false
    console.error("MongoDB connection error:", err.message)
  }
}
initDB()

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  phone: String,
  gender: String,
  universityId: String,
  passwordHash: String,
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() }
})

const verificationPhotoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fileName: String,
  createdAt: { type: Date, default: () => new Date() }
})

const User = mongoose.model("User", userSchema)
const VerificationPhoto = mongoose.model("VerificationPhoto", verificationPhotoSchema)

const uploadsDir = path.join(process.cwd(), "server_uploads")
fs.mkdirSync(uploadsDir, { recursive: true })
app.use("/uploads", express.static(uploadsDir))

const upload = multer({ dest: uploadsDir })

const requireDB = (_req, res, next) => {
  if (!dbReady) return res.status(200).json({ detail: "db_unavailable_fallback" })
  next()
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, db: !!dbReady })
})

app.post("/register", upload.single("collegeIdPhoto"), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, gender, universityId, password } = req.body
    if (!email || !password) return res.status(400).json({ detail: "Missing email or password" })
    if (!dbReady) {
      if (mem.users.has(email)) return res.status(409).json({ detail: "Email already registered" })
      const passwordHash = await bcrypt.hash(password, 10)
      const user = {
        _id: `mem:${email}`,
        firstName, lastName, email, phone, gender, universityId, passwordHash,
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
      const user = await User.create({ firstName, lastName, email, phone, gender, universityId, passwordHash })
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

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ detail: "Missing email or password" })
    if (!dbReady) {
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

app.get("/users/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return res.status(401).json({ detail: "Missing token" })
    const decoded = jwt.verify(token, JWT_SECRET)
    if (!dbReady || String(decoded.uid).startsWith("mem:")) {
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
          verified: !!user.verified,
          createdAt: user.createdAt?.toISOString() || null
        }
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
          verified: !!user.verified,
          createdAt: user.createdAt?.toISOString() || null
        }
      })
    }
  } catch (err) {
    console.error("Users/me error:", err?.message || err)
    return res.status(401).json({ detail: "Invalid token" })
  }
})

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err?.stack || err)
  res.status(500).json({ detail: "Server error" })
})
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Server running http://localhost:${port}`)
})

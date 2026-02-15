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
  rides: [],
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
  isRider: { type: Boolean, default: false },
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

app.post("/api/register", upload.single("collegeIdPhoto"), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, gender, universityId, password } = req.body
    if (!email || !password) return res.status(400).json({ detail: "Missing email or password" })
    if (!dbReady) {
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

app.post("/api/login", async (req, res) => {
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

app.get("/api/users/me", async (req, res) => {
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
          isRider: !!user.isRider,
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
          isRider: !!user.isRider,
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

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ detail: "Missing token" })
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = { uid: String(decoded.uid), email: decoded.email }
    next()
  } catch {
    return res.status(401).json({ detail: "Invalid token" })
  }
}

app.post("/api/users/me/rider", auth, async (req, res) => {
  try {
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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

const rideSchema = new mongoose.Schema({
  id: String,
  riderUid: String,
  riderName: String,
  currentLat: Number,
  currentLng: Number,
  pickupLat: Number,
  pickupLng: Number,
  destination: String,
  departureTime: String,
  pickupLater: Boolean,
  passengerUid: String,
  passengerName: String,
  passengerPhone: String,
  passengerLat: Number,
  passengerLng: Number,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: () => new Date() },
})
const Ride = mongoose.model("Ride", rideSchema)

const nextId = () => String(Date.now()) + "-" + Math.floor(Math.random() * 10000)

app.get("/api/ride-offers", auth, async (req, res) => {
  try {
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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

app.get("/api/ride-offers/:id", auth, async (req, res) => {
  try {
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
      const ride = mem.rides.find(r => r.id === req.params.id)
      if (!ride) return res.status(404).json({ detail: "Not found" })
      return res.json({ offer: ride })
    } else {
      let ride = await Ride.findOne({ id: req.params.id }).lean()
      if (!ride) {
        try {
          ride = await Ride.findById(req.params.id).lean()
        } catch {}
      }
      if (!ride) return res.status(404).json({ detail: "Not found" })
      return res.json({ offer: ride })
    }
  } catch (err) {
    return res.status(500).json({ detail: "Server error" })
  }
})

app.post("/api/ride-offers", auth, async (req, res) => {
  try {
    const { destination, departureTime, pickupLater, pickupLat, pickupLng, currentLat, currentLng } = req.body || {}
    if (!destination || !departureTime) return res.status(400).json({ detail: "Missing destination or time" })
    let riderName = null
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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

app.post("/api/ride-offers/:id/accept", auth, async (req, res) => {
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
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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

app.post("/api/ride-offers/:id/reject", auth, async (req, res) => {
  try {
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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

app.post("/api/ride-offers/:id/start", auth, async (req, res) => {
  try {
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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

app.post("/api/ride-offers/:id/cancel", auth, async (req, res) => {
  try {
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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

app.patch("/api/ride-offers/:id", auth, async (req, res) => {
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
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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

app.get("/api/rider/ride-offers", auth, async (req, res) => {
  try {
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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
app.post("/api/ride-offers/:id/complete", auth, async (req, res) => {
  try {
    if (!dbReady || String(req.user.uid).startsWith("mem:")) {
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
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err?.stack || err)
  res.status(500).json({ detail: "Server error" })
})
const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Server running http://localhost:${port}`)
})

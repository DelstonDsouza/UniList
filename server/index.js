import "dotenv/config"
import express from "express"
import cors from "cors"
import path from "path"
import { PORT } from "./config/env.js"
import { initDB } from "./config/db.js"
import logger from "./middleware/logger.js"
import authRoutes from "./routes/auth.routes.js"
import rideRoutes from "./routes/ride.routes.js"
import riderRoutes from "./routes/rider.routes.js"  

// ── Initialize ──────────────────────────────────────────────────────────────
const app = express()

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}))
app.options("*", cors())
app.use(logger)
app.use(express.json())

// ── Static uploads ──────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "server_uploads")))

// ── Connect to database ─────────────────────────────────────────────────────
initDB()

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes)
app.use("/api/rides", rideRoutes)
app.use("/api/rider", riderRoutes)

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err?.stack || err)  // ← already there?
  res.status(500).json({ detail: "Server error" })
})

// ── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running http://localhost:${PORT}`)
})

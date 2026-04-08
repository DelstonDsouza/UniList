import "dotenv/config"
import express from "express"
import cors from "cors"
import path from "path"
import { createServer } from "http"
import { Server } from "socket.io"

import { PORT } from "./config/env.js"
import { initDB } from "./config/db.js"
import logger from "./middleware/logger.js"
import authRoutes from "./routes/auth.routes.js"
import rideRoutes from "./routes/ride.routes.js"
import riderRoutes from "./routes/rider.routes.js"
import studentRoutes from "./routes/student.routes.js"
import adminRoutes from "./routes/admin.routes.js"
import complaintRoutes from "./routes/complaint.routes.js"

// ── App + HTTP server ────────────────────────────────────────────────────────
const app    = express()
const server = createServer(app)   // wrap express in http.Server for Socket.io

// ── Socket.io ────────────────────────────────────────────────────────────────
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id)

  socket.on("join:ride", (rideId) => {
    socket.join(`ride:${rideId}`)
    console.log(`🚗 Rider joined room ride:${rideId}`)
  })

  socket.on("join:passenger", (rideId) => {
    socket.join(`ride:${rideId}`)
    console.log(`🧍 Passenger joined room ride:${rideId}`)
  })

  socket.on("rider:location", ({ rideId, lat, lng }) => {
    socket.to(`ride:${rideId}`).emit("rider:location", { lat, lng })
  })

  socket.on("join:riders-watch", () => {
    socket.join("riders-watch")
    console.log(`👀 Passenger watching for rides: ${socket.id}`)
  })

  socket.on("join:user", (userId) => {
    socket.join(`user:${userId}`)
    console.log(`👤 User joined room user:${userId}`)
  })

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id)
  })
})

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}))
app.options("*", cors())
app.use(logger)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// ── Static uploads ───────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "server_uploads")))

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }))

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",authRoutes)
app.use("/api/rides",riderRoutes)
app.use("/api/rides",rideRoutes)
app.use("/api/rider",riderRoutes)
app.use("/api/students",studentRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/debug", adminRoutes)
app.use("/api/complaints", complaintRoutes)

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status || 500
  const message = err.message || "Server error"
  console.error(`[Error ${status}]:`, err?.stack || err)
  res.status(status).json({ detail: message })
})

// ── Start ─────────────────────────────────────────────────────────────────────
const startServer = async () => {
    try {
        await initDB()
        server.listen(PORT, () => {
            console.log(`🚀 Server running http://localhost:${PORT}`)
        })
    } catch (err) {
        console.error("❌ Critical server startup error:", err)
        process.exit(1)
    }
}

startServer()
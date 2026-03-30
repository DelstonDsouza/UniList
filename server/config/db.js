import mongoose from "mongoose"
import { MONGO_URL } from "./env.js"

let dbReady = false

// In-memory fallback store when MongoDB is unavailable
const mem = {
    users: new Map(), // email -> user
    photos: [],
    rides: [],
}

async function initDB() {
    try {
        console.log("📡 Connecting to MongoDB:", MONGO_URL)
        await mongoose.connect(MONGO_URL, {
            serverSelectionTimeoutMS: 5000,
        })
        dbReady = true
        console.log("✅ MongoDB connected successfully")
    } catch (err) {
        dbReady = false
        console.error("❌ MongoDB connection error:", err.message)
        throw err // Re-throw so the caller (index.js) knows it failed
    }
}

export const isDBReady = () => dbReady
export { mem, initDB }

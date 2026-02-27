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

export const isDBReady = () => dbReady
export { mem, initDB }

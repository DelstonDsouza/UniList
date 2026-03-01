import dotenv from "dotenv"
dotenv.config()


export const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/ridemate"
export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret"
export const PORT = process.env.PORT || 3001

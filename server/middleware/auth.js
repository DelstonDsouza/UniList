import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../config/env.js"

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

export default auth

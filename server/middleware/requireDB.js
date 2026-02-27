import { isDBReady } from "../config/db.js"

const requireDB = (_req, res, next) => {
    if (!isDBReady()) return res.status(200).json({ detail: "db_unavailable_fallback" })
    next()
}

export default requireDB

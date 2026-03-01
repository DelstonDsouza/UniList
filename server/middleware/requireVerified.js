// server/middleware/requireVerified.js
// No verified field  — anyone with a valid JWT is trusted
export default function requireVerified(req, res, next) {
  if (!req.user) return res.status(401).json({ detail: "Not authenticated" })
  next()
}
// server/middleware/requireVerified.js
// CREATE this new file
// Blocks unverified users (admin hasn't approved their ID yet)

export default function requireVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Login required" },
    })
  }
  if (!req.user.verified) {
    return res.status(403).json({
      success: false,
      error: {
        code: "NOT_VERIFIED",
        message: "Your account is pending admin verification. Please wait for approval.",
      },
    })
  }
  next()
}
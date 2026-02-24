// src/hooks/useOTPVerification.js
import { useState, useCallback } from "react"
import { verifyRideOTP } from "../services/rideService"

export const useOTPVerification = (rideId) => {
  const [verifying, setVerifying] = useState(false)
  const [error,     setError]     = useState(null)
  const [attempts,  setAttempts]  = useState(0)
  const [verified,  setVerified]  = useState(false)

  const verify = useCallback(async (otp) => {
    if (otp.length !== 4) { setError("Enter a 4-digit OTP"); return false }
    setVerifying(true)
    setError(null)
    try {
      const result = await verifyRideOTP(rideId, otp)
      if (result.success) { setVerified(true); return true }
      setAttempts(result.attempts)
      setError("Wrong OTP. Ask your passenger again.")
      return false
    } catch {
      setError("Verification failed. Try again.")
      return false
    } finally {
      setVerifying(false)
    }
  }, [rideId])

  const reset = useCallback(() => {
    setError(null); setVerified(false); setAttempts(0)
  }, [])

  return { verify, verifying, error, attempts, verified, reset }
}
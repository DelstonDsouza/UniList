// src/pages/auth/Login.jsx

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth } from "../../config/firebase"
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth"
import { apiFetch, setToken } from "../../services/api"

export default function Login() {
  const [step,    setStep]    = useState(1)
  const [phone,   setPhone]   = useState("")
  const [otp,     setOtp]     = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const navigate = useNavigate()

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      )
    }
  }

  const sendOtp = async () => {
    setError("")
    if (phone.length !== 10) {
      setError("Enter a valid 10-digit mobile number")
      return
    }
    try {
      setLoading(true)
      setupRecaptcha()
      const confirmation = await signInWithPhoneNumber(
        auth,
        "+91" + phone,
        window.recaptchaVerifier
      )
      window.confirmationResult = confirmation
      setStep(2)
    } catch (err) {
      console.error("OTP send error:", err)
      setError("Failed to send OTP. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    setError("")
    try {
      setLoading(true)

      // 1. Verify OTP with Firebase
      const result      = await window.confirmationResult.confirm(otp)
      const firebaseUser = result.user

      // 2. Get Firebase ID token
      const idToken = await firebaseUser.getIdToken()

      // 3. Exchange for backend JWT
      const data = await apiFetch("/auth/firebase", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idToken }),
      })

      // 4. Save JWT
      setToken(data.token)

      // 5. Save basic user info
      localStorage.setItem("user", JSON.stringify({
        uid:   data.userId,
        phone: firebaseUser.phoneNumber,
      }))

      // 6. Navigate based on profile completeness
      if (!data.profileComplete) {
        navigate("/register-details")
      } else if (!data.roleSelected) {
        navigate("/select-role")
      } else if (data.role === "rider") {
        navigate("/rider-home")
      } else {
        navigate("/passenger-home")
      }

    } catch (err) {
      console.error("OTP verify error:", err)
      setError("Invalid OTP or authentication failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-6 pt-6 flex flex-col justify-between">

      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/")} className="text-2xl font-bold">←</button>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className={`w-12 h-1 rounded ${step >= 1 ? "bg-black" : "bg-gray-300"}`} />
              <div className={`w-12 h-1 rounded ${step >= 2 ? "bg-black" : "bg-gray-300"}`} />
            </div>
            <span className="text-lg font-semibold">{step}/2</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-6">Let's get you trip-ready!</h1>

        {step === 1 && (
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <label className="text-gray-700 text-lg font-semibold">
              Enter your Mobile Number
            </label>
            <div className="flex gap-2 mt-3">
              <div className="bg-gray-200 px-4 py-3 rounded-lg">🇮🇳 +91</div>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                className="flex-1 bg-gray-200 p-3 rounded-lg outline-none"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <label className="text-gray-600 text-sm">Enter OTP sent to +91{phone}</label>
            <input
              type="text"
              placeholder="Enter 6 digit OTP"
              className="w-full bg-gray-200 p-3 rounded-lg mt-3 outline-none"
              value={otp}
              onChange={e => setOtp(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
      </div>

      {/* Footer */}
      <div className="pb-6">
        <p className="text-center text-sm text-gray-500 mb-4">
          By clicking Continue, you agree to our <b>T&Cs</b>
        </p>
        {step === 1 && (
          <button
            onClick={sendOtp}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? "Sending..." : "Continue"}
          </button>
        )}
        {step === 2 && (
          <button
            onClick={verifyOtp}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Continue"}
          </button>
        )}
      </div>

      <div id="recaptcha-container"></div>
    </div>
  )
}
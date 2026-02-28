import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth } from "../../config/firebase"
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth"

export default function Login() {
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Setup invisible reCAPTCHA
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      )
    }
  }

  // Send OTP
  const sendOtp = async () => {
    if (phone.length !== 10) {
      alert("Enter valid 10-digit mobile number")
      return
    }

    try {
      setLoading(true)
      setupRecaptcha()

      const appVerifier = window.recaptchaVerifier
      const fullPhone = "+91" + phone

      const confirmation = await signInWithPhoneNumber(
        auth,
        fullPhone,
        appVerifier
      )

      window.confirmationResult = confirmation
      setStep(2)
    } catch (error) {
      console.error("OTP Send Error:", error)
      alert("OTP failed to send")
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP and authenticate backend
  const verifyOtp = async () => {
    try {
      setLoading(true)

      // 1️⃣ Verify OTP with Firebase
      const result = await window.confirmationResult.confirm(otp)
      const firebaseUser = result.user

      // 2️⃣ Get Firebase ID Token
      const idToken = await firebaseUser.getIdToken()

      // 3️⃣ Send Firebase token to backend
      const response = await fetch("http://localhost:5000/api/auth/firebase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idToken })
      })

      if (!response.ok) {
        throw new Error("Backend authentication failed")
      }

      const data = await response.json()

      if (!data.token) {
        throw new Error("JWT not received from backend")
      }

      // 4️⃣ Store backend JWT
      localStorage.setItem("token", data.token)

      // 5️⃣ Store user info
      const phoneNumber = firebaseUser.phoneNumber.replace("+91", "")
      localStorage.setItem(
        "user",
        JSON.stringify({
          phone: phoneNumber,
          uid: firebaseUser.uid
        })
      )

      // 6️⃣ Navigate based on profile/role
      const completed = localStorage.getItem(`profile_${phoneNumber}`)
      const role = localStorage.getItem(`role_${phoneNumber}`)

      if (!completed) {
        navigate("/register-details")
        return
      }

      if (!role) {
        navigate("/select-role")
        return
      }

      if (role === "rider") {
        navigate("/rider-home")
      } else {
        navigate("/passenger-home")
      }

    } catch (error) {
      console.error("OTP Verification Error:", error)
      alert("Invalid OTP or authentication failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-6 pt-6 flex flex-col justify-between">

      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/")}
            className="text-2xl font-bold"
          >
            ←
          </button>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className={`w-12 h-1 rounded ${step >= 1 ? "bg-black" : "bg-gray-300"}`} />
              <div className={`w-12 h-1 rounded ${step >= 2 ? "bg-black" : "bg-gray-300"}`} />
              <div className={`w-12 h-1 rounded ${step >= 3 ? "bg-black" : "bg-gray-300"}`} />
            </div>
            <span className="text-lg font-semibold">
              {step}/3
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-6">
          Let's get you trip-ready!
        </h1>

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
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <label className="text-gray-600 text-sm">
              Enter OTP
            </label>

            <input
              type="text"
              placeholder="Enter 6 digit OTP"
              className="w-full bg-gray-200 p-3 rounded-lg mt-3 outline-none"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div>
        <p className="text-center text-sm text-gray-500 mb-4">
          By clicking Continue, you agree to our <b>T&Cs</b>
        </p>

        {step === 1 && (
          <button
            onClick={sendOtp}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            {loading ? "Sending..." : "Continue"}
          </button>
        )}

        {step === 2 && (
          <button
            onClick={verifyOtp}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            {loading ? "Verifying..." : "Continue"}
          </button>
        )}
      </div>

      <div id="recaptcha-container"></div>
    </div>
  )
}
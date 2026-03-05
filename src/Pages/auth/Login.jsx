// src/pages/auth/Login.jsx

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth } from "../../config/firebase"
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth"
import { apiFetch, setToken } from "../../services/api"
import { X } from "lucide-react"

const terms = [
  {
    title: "1. Acceptance of Terms",
    body: "By accessing or using the UniLift platform, users agree to comply with and be bound by these Terms and Conditions. UniLift is a ride-sharing platform designed specifically for students within the same college community.",
  },
  {
    title: "2. Eligibility",
    body: "UniLift is intended only for registered students of the participating college. Users must register using valid university credentials or student identification. Unauthorized users are not permitted to access or use the platform.",
  },
  {
    title: "3. User Responsibilities",
    body: "Users must provide accurate and up-to-date information during registration. Both riders and passengers must behave respectfully and responsibly while using the platform. Any misuse, harassment, or inappropriate behavior may lead to suspension or termination of the user account.",
  },
  {
    title: "4. Ride Sharing Rules",
    body: "Riders must ensure that their vehicle is in good condition and safe to use. Passengers should be present at the pickup location at the agreed time. Both parties should verify ride details before starting the journey.",
  },
  {
    title: "5. Safety and Conduct",
    body: "All users must follow traffic rules and safety regulations during the ride. Riders are responsible for safe driving practices, and passengers must follow the rider's safety instructions. Any dangerous or illegal behavior is strictly prohibited.",
  },
  {
    title: "6. Payment and Fare",
    body: "Fare details will be displayed before the ride begins. Passengers must pay the agreed fare upon completion of the ride using the available payment method on the platform.",
  },
  {
    title: "7. Privacy and Data Usage",
    body: "UniLift respects user privacy. Personal information such as names, phone numbers, and location details will only be used for ride coordination and platform functionality. User data will not be shared with unauthorized third parties.",
  },
  {
    title: "8. Limitation of Liability",
    body: "UniLift acts only as a platform that connects riders and passengers within the college community. The platform is not responsible for any accidents, injuries, damages, or disputes that may occur during rides.",
  },
  {
    title: "9. Account Suspension or Termination",
    body: "UniLift reserves the right to suspend or terminate any account that violates these Terms and Conditions, engages in misuse of the platform, or causes harm to other users.",
  },
  {
    title: "10. Changes to Terms",
    body: "UniLift may update or modify these Terms and Conditions at any time. Continued use of the platform after changes are made indicates acceptance of the revised terms.",
  },
  {
    title: "11. Contact and Support",
    body: "For any questions, concerns, or support regarding the UniLift platform, users may contact the system administrators or project team.",
  },
]

function TermsModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Terms & Conditions</h2>
            <p className="text-xs text-gray-400 mt-0.5">UniLift Student Ride Sharing</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1">
          {terms.map((section, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{section.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full bg-black text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            I Understand
          </button>
        </div>

      </div>
    </div>
  )
}

export default function Login() {
  const [step,      setStep]      = useState(1)
  const [phone,     setPhone]     = useState("")
  const [otp,       setOtp]       = useState("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [showTerms, setShowTerms] = useState(false)
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

      const result       = await window.confirmationResult.confirm(otp)
      const firebaseUser = result.user
      const idToken      = await firebaseUser.getIdToken()

      const data = await apiFetch("/auth/firebase", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idToken }),
      })

      setToken(data.token)

      localStorage.setItem("user", JSON.stringify({
        uid:   data.userId,
        phone: firebaseUser.phoneNumber,
      }))

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

      {/* T&C Modal */}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

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
        <p className="text-center text-sm text-gray-500 mb-3">
          New user?{" "}
          <a href="/register" className="text-black font-semibold underline">Register here</a>
        </p>

        <p className="text-center text-sm text-gray-500 mb-4">
          By clicking Continue, you agree to our{" "}
          <button
            onClick={() => setShowTerms(true)}
            className="font-bold text-black underline"
          >
            T&Cs
          </button>
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
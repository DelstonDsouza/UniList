// src/pages/auth/Login.jsx

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { auth } from "../../config/firebase"
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth"
import { apiFetch, setToken } from "../../services/api"
import { X } from "lucide-react"
import { toast } from "react-hot-toast" // Added toast for better feedback if available

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
  const navigate = useNavigate()
  const location = useLocation()
  const prefillPhoneFromState = location.state?.prefillPhone || ""

  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState(prefillPhoneFromState)
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showTerms, setShowTerms] = useState(false)

  useEffect(() => {
    // Check if we already have a valid session
    const token = localStorage.getItem("token")
    if (token) {
      console.log("⚡ Found existing session, redirecting based on role...")
      try {
        const userData = JSON.parse(localStorage.getItem("user") || "{}")
        // If we don't have role in localStorage, it will be fetched in AuthGate anyway
        // or we can just send to dashboard as a safe default.
        if (userData.isRider) {
          navigate("/rider-home", { replace: true })
        } else {
          navigate("/dashboard", { replace: true })
        }
      } catch (e) {
        navigate("/dashboard", { replace: true })
      }
    }

    // Ensure a fresh recaptcha verifier on every mount
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear() } catch (e) { }
      window.recaptchaVerifier = null
    }
  }, [navigate])

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
    const phoneRegex = /^[0-9]{10}$/

    if (!phoneRegex.test(phone)) {
      setError("Please enter a 10-digit mobile number")
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
      setError("Please check the mobile number and try again.")
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    setError("")
    try {
      setLoading(true)

      const result = await window.confirmationResult.confirm(otp)
      const firebaseUser = result.user
      const idToken = await firebaseUser.getIdToken()

      const data = await apiFetch("/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      setToken(data.token)

      localStorage.setItem("user", JSON.stringify({
        uid: data.userId,
        phone: firebaseUser.phoneNumber,
      }))

      if (!data.profileComplete) {
        navigate("/register")
        return
      }

      // ── Check role & active ride, redirect accordingly ──
      try {
        console.log("🔍 Fetching profile...")
        const profile = await apiFetch("/auth/me")
        const userData = profile?.user
        const isRider = userData?.isRider === true

        console.log("👤 User role:", isRider ? "rider" : "passenger")

        if (isRider) {
          // Check if rider has an active ride in progress
          console.log("🚗 Checking active rides for rider...")
          const ridesData = await apiFetch("/rides/my")
          const rides = ridesData?.data?.rides || []
          const activeRide = rides.find(r =>
            ["locked", "pickup_started", "ongoing"].includes(r.status)
          )

          if (activeRide) {
            console.log("🔄 Restoring active ride:", activeRide._id)
            // Restore rider to the correct active page
            if (activeRide.status === "locked") {
              navigate("/ride-confirmed", {
                replace: true,
                state: {
                  rideId: activeRide._id,
                  passengerName: activeRide.passenger?.name,
                  passengerPhone: activeRide.passenger?.phone,
                  passengerLat: activeRide.passenger?.location?.coordinates?.[1],
                  passengerLng: activeRide.passenger?.location?.coordinates?.[0],
                  fare: activeRide.fare?.amount,
                  distanceKm: activeRide.fare?.distanceKm,
                }
              })
            } else {
              navigate("/ride-pickup", {
                replace: true,
                state: {
                  rideId: activeRide._id,
                  passengerName: activeRide.passenger?.name,
                  passengerPhone: activeRide.passenger?.phone,
                  passengerPickup: activeRide.passenger?.location?.coordinates
                    ? [activeRide.passenger.location.coordinates[1], activeRide.passenger.location.coordinates[0]]
                    : null,
                  fare: activeRide.fare?.amount,
                }
              })
            }
            return
          }

          navigate("/rider-home", { replace: true })
        } else {
          navigate("/dashboard", { replace: true })
        }
      } catch (profileErr) {
        console.error("Profile fetch/redirect error:", profileErr)
        // Fallback if profile fetch fails
        navigate("/dashboard", { replace: true })
      }

    } catch (err) {
      console.error("OTP verify error:", err)
      setError(err.message || "The OTP entered is incorrect. Please try again")
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

        <h1 className="text-2xl font-semibold mb-6">Let's get you trip-ready!</h1><br></br>

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
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "")
                  if (value.length <= 10) {
                    setPhone(value)
                  }
                }}
                maxLength={10}
                inputMode="numeric"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <div className="flex flex-col gap-3">


              <p className="text-gray-500 text-sm">
                Enter OTP Sent to +91{phone}
              </p>

              <input
                type="tel"
                placeholder="Enter 6 digit OTP"
                className="w-full bg-gray-200 p-3 rounded-lg outline-none mt-2"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "")
                  if (value.length <= 6) {
                    setOtp(value)
                  }
                }}
                maxLength={6}
                inputMode="numeric"
              />

            </div>
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
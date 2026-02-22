import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth } from "../firebase/firebase-config"
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth"

export default function Login() {
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const navigate = useNavigate()

  // setup invisible captcha
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      )
    }
  }

  // send otp
  const sendOtp = async () => {
    if (phone.length !== 10) {
      alert("Enter valid mobile number")
      return
    }

    try {
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
      console.error(error)
      alert("OTP failed to send")
    }
  }

  // verify otp and route correctly
  const verifyOtp = async () => {
    try {
      const result = await window.confirmationResult.confirm(otp)
      const firebaseUser = result.user

      const phoneNumber = firebaseUser.phoneNumber.replace("+91", "")

      // save logged-in user
      localStorage.setItem(
        "user",
        JSON.stringify({
          phone: phoneNumber,
          uid: firebaseUser.uid
        })
      )

      // check profile + role
      const completed = localStorage.getItem(`profile_${phoneNumber}`)
      const role = localStorage.getItem(`role_${phoneNumber}`)

      // new user → register page
      if (!completed) {
        navigate("/register-details")
        return
      }

      // registered but role not selected
      if (!role) {
        navigate("/select-role")
        return
      }

      // role exists → open respective home
      if (role === "rider") {
        navigate("/rider-home")
      } else {
        navigate("/passenger-home")
      }

    } catch (error) {
      console.error(error)
      alert("Invalid OTP")
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-6 pt-6 flex flex-col justify-between">

      {/* TOP HEADER */}
      <div>
        <div className="flex items-center justify-between mb-6">

          {/* BACK BUTTON */}
          <button
            onClick={() => navigate("/")}
            className="text-2xl font-bold"
          >
            ←
          </button>

          {/* PROGRESS BAR */}
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

        {/* PHONE STEP */}
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

        {/* OTP STEP */}
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

      {/* FOOTER */}
      <div>
        <p className="text-center text-sm text-gray-500 mb-4">
          By clicking Continue, you agree to our <b>T&Cs</b>
        </p>

        {step === 1 && (
          <button
            onClick={sendOtp}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            Continue
          </button>
        )}

        {step === 2 && (
          <button
            onClick={verifyOtp}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            Continue
          </button>
        )}
      </div>

      {/* Invisible recaptcha */}
      <div id="recaptcha-container"></div>
    </div>
  )
}

// src/pages/passenger/PassengerOTPDisplay.jsx
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useRide } from "../../context/RideContext"
import { useRideListener } from "../../hooks/useRideListener"

export default function PassengerOTPDisplay() {
  const navigate         = useNavigate()
  const location         = useLocation()
  const { ride, setRide } = useRide()
  const [pulse, setPulse]  = useState(true)

  // OTP may come from router state (if passenger just matched) or from context
  const displayOTP = ride.otp ?? location.state?.otp ?? "----"
  const riderName  = ride.riderName  ?? location.state?.riderName  ?? "Your Rider"
  const fare       = ride.fare       ?? location.state?.fare        ?? "—"
  const distance   = ride.distance   ?? location.state?.distance    ?? "—"
  const dropLabel  = ride.destination?.label ?? "College"

  // Redirect if no ride
  useEffect(() => {
    if (!ride.rideId && !location.state?.rideId) {
      navigate("/passenger-home", { replace: true })
    }
  }, [])

  // Listen for OTP verified → status becomes active → redirect
  useRideListener(ride.rideId ?? location.state?.rideId, (data) => {
    setRide(data)
    if (data.status === "active") {
      navigate("/passenger-active", { replace: true })
    }
  })

  // Pulse hint animation
  useEffect(() => {
    const t = setInterval(() => setPulse((v) => !v), 900)
    return () => clearInterval(t)
  }, [])

  const digits = String(displayOTP).split("")

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #1E40AF 0%, #2563EB 55%, #1D4ED8 100%)" }}
    >
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">

        {/* Bike icon with ripple rings */}
        <div className="relative mb-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{
              background:    "rgba(255,255,255,0.15)",
              border:        "2px solid rgba(255,255,255,0.3)",
              backdropFilter: "blur(8px)",
            }}
          >
            🏍️
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
              style={{
                width:            80 + i * 40,
                height:           80 + i * 40,
                opacity:          0.15 - i * 0.04,
                animation:        `ripple 2s ease-out ${i * 0.4}s infinite`,
                pointerEvents:    "none",
              }}
            />
          ))}
        </div>

        <p className="text-blue-100 text-xs font-semibold uppercase tracking-widest mb-1">
          Rider On The Way
        </p>
        <h1 className="text-white text-2xl font-bold text-center mb-1">
          {riderName}
        </h1>
        <p className="text-blue-200 text-sm text-center mb-10">
          is headed to your pickup location
        </p>

        {/* OTP Card */}
        <div
          className="w-full max-w-xs rounded-3xl p-6 flex flex-col items-center"
          style={{
            background:     "rgba(255,255,255,0.12)",
            border:         "1.5px solid rgba(255,255,255,0.25)",
            backdropFilter: "blur(12px)",
          }}
        >
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-4">
            Your Boarding OTP
          </p>

          {/* Digit boxes */}
          <div className="flex gap-3 mb-5">
            {digits.map((d, i) => (
              <div
                key={i}
                className="w-16 h-20 rounded-2xl flex items-center justify-center text-4xl font-black"
                style={{
                  background:  "white",
                  color:       "#2563EB",
                  boxShadow:   "0 4px 20px rgba(37,99,235,0.2)",
                  border:      "2px solid #BFDBFE",
                  animationDelay: `${i * 80}ms`,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Pulse hint */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.1)",
              opacity:    pulse ? 1 : 0.45,
              transition: "opacity 0.5s ease",
            }}
          >
            <span>🔒</span>
            <p className="text-white text-xs font-medium">Share only with your rider</p>
          </div>
        </div>
      </div>

      {/* Bottom summary sheet */}
      <div
        className="px-6 pt-5 pb-8"
        style={{ background: "white", borderRadius: "28px 28px 0 0" }}
      >
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Ride Summary
        </p>

        {/* Rider strip */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
          >
            {riderName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{riderName}</p>
            <p className="text-xs text-gray-500">🏍️ Two Wheeler · College Ride</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">Your Fare</p>
            <p className="text-base font-bold text-green-600">₹{fare}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: "#F8FAFF", border: "1.5px solid #E0EAFF" }}
          >
            <p className="text-xs text-gray-400 mb-0.5">Drop</p>
            <p className="text-xs font-bold text-gray-700 truncate">{dropLabel}</p>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
          >
            <p className="text-xs text-gray-400 mb-0.5">Distance</p>
            <p className="text-xs font-bold text-green-600">
              {typeof distance === "number" ? `${distance.toFixed(1)} km` : distance}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
          Waiting for rider to arrive and scan your OTP...
        </p>
      </div>

      <style>{`
        @keyframes ripple {
          0%   { transform: translate(-50%, -50%) scale(0.9); opacity: 0.2; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
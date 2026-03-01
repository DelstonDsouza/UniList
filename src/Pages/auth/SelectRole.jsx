// src/pages/auth/SelectRole.jsx

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../../services/api"

export default function SelectRole() {
  const navigate  = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const handleSelect = async (role) => {
    setLoading(true)
    setError("")
    try {
      await apiFetch("/auth/profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isRider: role === "rider" }),
      })

      // Update localStorage
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      localStorage.setItem("user", JSON.stringify({ ...user, isRider: role === "rider" }))

      if (role === "rider") {
        navigate("/rider-home")
      } else {
        navigate("/passenger-home")
      }
    } catch (err) {
      setError("Failed to save role. Try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6">

      <h1 className="text-2xl font-bold mb-4 text-center">Select your role</h1>
      <p className="text-gray-500 text-sm mb-12 text-center">
        You can switch roles later in your profile
      </p>

      <div className="flex gap-8">
        <button
          onClick={() => handleSelect("rider")}
          disabled={loading}
          className="bg-black text-white w-44 py-6 rounded-2xl text-lg font-semibold
                     transition duration-300 hover:shadow-xl hover:scale-105 disabled:opacity-50"
        >
          🏍 RIDER
        </button>

        <button
          onClick={() => handleSelect("passenger")}
          disabled={loading}
          className="bg-black text-white w-44 py-6 rounded-2xl text-lg font-semibold
                     transition duration-300 hover:shadow-xl hover:scale-105 disabled:opacity-50"
        >
          🎒 PASSENGER
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mt-6">{error}</p>}
    </div>
  )
}
// src/pages/auth/RegisterDetails.jsx

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../../services/api"

export default function RegisterDetails() {
  const navigate = useNavigate()

  const [universityId, setUniversityId] = useState("")
  const [email, setEmail] = useState("")
  const [fetched, setFetched] = useState(null)
  const [fetchError, setFetchError] = useState("")
  const [fetching, setFetching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const handleFetch = async () => {
    const uid = universityId.trim().toUpperCase()
    if (!uid) return

    setFetching(true)
    setFetchError("")
    setFetched(null)

    try {
      const data = await apiFetch(`/students/${uid}`)
      setFetched(data.data)
    } catch (err) {
      setFetchError(err.message || "University ID not found")
    } finally {
      setFetching(false)
    }
  }

  const handleSubmit = async () => {
    if (!fetched) {
      setFetchError("Please fetch your University ID first")
      return
    }

    if (!email.trim() || !email.includes("@")) {
      setSubmitError("Please enter a valid email address")
      return
    }

    const token = localStorage.getItem("token")
    if (token) {
      // SCENARIO 2: Finalizing profile after login
      setSubmitting(true)
      try {
        await apiFetch("/auth/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: fetched.firstName,
            lastName: fetched.lastName,
            gender: fetched.gender,
            universityId: fetched.universityId,
            email,
          }),
        })
        navigate("/dashboard", { replace: true })
      } catch (err) {
        setSubmitError(err.message || "Failed to save profile")
      } finally {
        setSubmitting(false)
      }
    } else {
      // SCENARIO 1: First-time registration (before login)
      // Redirect to login with the fetched phone number
      navigate("/login", { state: { prefillPhone: fetched.phone } })
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 space-y-5">

        <h1 className="text-2xl font-bold text-center">Complete Your Profile</h1><br></br>


        {/* University ID + Fetch button */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            University ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={universityId}
              onChange={e => {
                setUniversityId(e.target.value.toUpperCase())
                setFetched(null)
                setFetchError("")
              }}
              placeholder="e.g. SAC001"
              className="flex-1 bg-gray-100 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              onClick={handleFetch}
              disabled={fetching || !universityId.trim()}
              className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {fetching ? "..." : "Fetch"}
            </button>
          </div>
          {fetchError && (
            <p className="text-red-500 text-xs mt-1">⚠ {fetchError}</p>
          )}
        </div>

        {/* Auto-filled fields — read only */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">First Name</label>
          <input
            type="text"
            value={fetched?.firstName || ""}
            readOnly
            placeholder="Auto-filled"
            className="w-full bg-gray-100 p-3 rounded-lg text-sm text-gray-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Last Name</label>
          <input
            type="text"
            value={fetched?.lastName || ""}
            readOnly
            placeholder="Auto-filled"
            className="w-full bg-gray-100 p-3 rounded-lg text-sm text-gray-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Gender</label>
          <input
            type="text"
            value={fetched?.gender || ""}
            readOnly
            placeholder="Auto-filled"
            className="w-full bg-gray-100 p-3 rounded-lg text-sm text-gray-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Mobile Number</label>
          <div className="flex gap-2">
            <div className="bg-gray-100 px-4 py-3 rounded-lg text-sm text-gray-500 cursor-not-allowed">
              +91
            </div>

            <input
              type="text"
              value={fetched?.phone || ""}
              readOnly
              placeholder="Auto-filled"
              className="w-full bg-gray-100 p-3 rounded-lg text-sm text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>
        {/* Email — user must enter this */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setSubmitError("") }}
            placeholder="your@email.com"
            className="w-full bg-gray-100 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {submitError && (
          <p className="text-red-500 text-xs">⚠ {submitError}</p>
        )}

        {/* Success indicator */}
        {fetched && !fetchError && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <span>✓</span>
            <span>Student record found - {fetched.firstName} {fetched.lastName}</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!fetched}
          className="w-full bg-black text-white py-3 rounded-lg font-medium disabled:opacity-50 transition"
        >
          Proceed to Login & Verify OTP
        </button>

        <p className="text-center text-sm text-gray-500">
          Already registered?{" "}
          <a href="/login" className="text-black font-medium underline">Sign in</a>
        </p>

      </div>
    </div>
  )
}
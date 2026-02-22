import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

export default function RegisterDetails() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    gender: "",
    collegeId: ""
  })

  // Skip this page if THIS phone already registered earlier
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"))
    if (!user) return

    const completed = localStorage.getItem(`profile_${user.phone}`)

    if (completed === "true") {
      navigate("/dashboard")
    }
  }, [])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = () => {
    const user = JSON.parse(localStorage.getItem("user"))

    if (!user) {
      alert("User not logged in")
      return
    }

    // Save registration PER PHONE NUMBER
    localStorage.setItem(`profile_${user.phone}`, "true")
    localStorage.setItem(`userDetails_${user.phone}`, JSON.stringify(form))

    navigate("/select-role")
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      <h1 className="text-3xl font-bold mb-6 text-center">Sign up</h1>

      <div className="space-y-4">

        <input
          type="text"
          name="firstname"
          placeholder="Firstname"
          className="w-full bg-gray-200 p-4 rounded-lg"
          onChange={handleChange}
        />

        <input
          type="text"
          name="lastname"
          placeholder="Lastname"
          className="w-full bg-gray-200 p-4 rounded-lg"
          onChange={handleChange}
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          className="w-full bg-gray-200 p-4 rounded-lg"
          onChange={handleChange}
        />

        <select
          name="gender"
          className="w-full bg-gray-200 p-4 rounded-lg"
          onChange={handleChange}
          defaultValue=""
        >
          <option value="" disabled>Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>

        <input
          type="text"
          name="collegeId"
          placeholder="College ID Number"
          className="w-full bg-gray-200 p-4 rounded-lg"
          onChange={handleChange}
        />

      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-black text-white py-3 rounded-lg mt-6"
      >
        Register
      </button>

    </div>
  )
}

import { useState } from "react"
import { FaEye, FaEyeSlash } from "react-icons/fa"
import { apiFetch } from "../lib/api"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"

function Register() {
  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    universityId: "",
    password: "",
    confirmPassword: "",
    collegeIdPhoto: null,
  })

  const handleChange = (e) => {
    const { name, value, files } = e.target
    setFormData({
      ...formData,
      [name]: files ? files[0] : value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // 🔒 Validation
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (!formData.collegeIdPhoto) {
      toast.error("Please upload College ID photo")
      return
    }

    const toastId = toast.loading("Creating account...")

    try {
      setLoading(true)

      // 1️⃣ FormData
      const data = new FormData()
      data.append("firstName", formData.firstName)
      data.append("lastName", formData.lastName)
      data.append("email", formData.email)
      data.append("phone", formData.phone)
      data.append("gender", formData.gender)
      data.append("universityId", formData.universityId)
      data.append("password", formData.password)
      data.append("collegeIdPhoto", formData.collegeIdPhoto)

      // 2️⃣ Backend request
      await apiFetch("/register", {
        method: "POST",
        body: data,
      })

      toast.success("Registration successful 🎉", { id: toastId })

      // 🚀 Redirect to login after short delay
      setTimeout(() => {
        navigate("/login")
      }, 1200)

    } catch (err) {
      toast.error(err.message || "Something went wrong", { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900
                      border border-slate-200 dark:border-slate-800
                      rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">
          Create Your Account
        </h1>

        <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
          Register using your college details
        </p>

        <form onSubmit={handleSubmit} className="grid gap-6">

          <div className="grid md:grid-cols-2 gap-4">
            <input name="firstName" placeholder="First Name" required onChange={handleChange} className="input" />
            <input name="lastName" placeholder="Last Name" required onChange={handleChange} className="input" />
          </div>

          <input type="email" name="email" placeholder="Email Address" required onChange={handleChange} className="input" />
          <input type="tel" name="phone" placeholder="Phone Number" required onChange={handleChange} className="input" />

          <select name="gender" required onChange={handleChange} className="input">
            <option value="">Select Gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>

          <input name="universityId" placeholder="University / College ID Number" required onChange={handleChange} className="input" />

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              required
              onChange={handleChange}
              className="input pr-12"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              required
              onChange={handleChange}
              className="input pr-12"
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {/* College ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Upload College ID Card
            </label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) =>
                setFormData({ ...formData, collegeIdPhoto: e.target.files[0] })
              }
              className="file-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700
                       text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? "Creating account..." : "Register"}
          </button>

        </form>
      </div>
    </section>
  )
}

export default Register

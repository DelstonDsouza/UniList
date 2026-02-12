import { useState } from "react"
import { FaEye, FaEyeSlash } from "react-icons/fa"
import { apiFetch, setToken } from "../lib/api"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"

function LoginUser() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const toastId = toast.loading("Logging in...")

    try {
      setLoading(true)

      const data = await apiFetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })
      setToken(data.token)
      toast.success("Login successful 🎉", { id: toastId })
      navigate("/dashboard")

    } catch (err) {
      toast.error(err.message || "Login failed", { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-6">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900
                   border border-slate-200 dark:border-slate-800
                   rounded-2xl shadow-xl p-8"
      >
        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">Login to KozhiGo</h1>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-8">Welcome back 👋</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <input type="email" placeholder="Email address" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600" />
          <div className="relative">
            <input type={showPassword ? "text" : "password"} placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 pr-12" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="text-sm text-center text-slate-500 dark:text-slate-400 mt-6">
          Don’t have an account? <a href="/register" className="text-blue-600 hover:underline">Create one</a>
        </p>
      </div>
    </section>
  )
}

export default LoginUser

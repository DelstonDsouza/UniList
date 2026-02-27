import { useState } from "react"
import { API_BASE, setToken, clearToken } from "../../services/api"
import { Link, useNavigate } from "react-router-dom"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok || !data?.token) throw new Error(data?.detail || "Login failed")
      setToken(data.token)
      const meRes = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${data.token}` }
      })
      if (!meRes.ok) throw new Error("Failed to fetch user")
      const me = await meRes.json()
      if (!me?.user) throw new Error("Login failed: user not found")
      localStorage.setItem("user", JSON.stringify(me.user))
      localStorage.removeItem("isRider")
      localStorage.removeItem("riderProfile")
      navigate("/dashboard")
    } catch (err) {
      clearToken()
      alert(err.message)
    }

    setLoading(false)
  }

  return (
    <section className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900
                      border border-slate-200 dark:border-slate-800
                      rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">
          Login to KozhiGo
        </h1>

        <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
          Welcome back 👋
        </p>

        <form onSubmit={handleLogin} className="space-y-5">

          <input
            type="email"
            placeholder="Email address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border
                       border-slate-300 dark:border-slate-700
                       bg-white dark:bg-slate-950
                       text-slate-900 dark:text-white"
          />

          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border
                       border-slate-300 dark:border-slate-700
                       bg-white dark:bg-slate-950
                       text-slate-900 dark:text-white"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700
                       text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="text-sm text-center text-slate-500 dark:text-slate-400 mt-6">
          Don’t have an account?{" "}
          <Link to="/register" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>

      </div>
    </section>
  )
}

export default Login

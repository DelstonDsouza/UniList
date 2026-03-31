import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import toast from "react-hot-toast"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()

  const handleLogin = (e) => {
    e.preventDefault()
    if (email === "admin@college.com" && password === "admin123") {
      localStorage.setItem("isAdmin", "true")
      toast.success("Welcome, Admin")
      navigate("/admin/dashboard")
    } else {
      toast.error("Invalid admin credentials")
    }
  }

  return (
    <div className="min-h-[100dvh] bg-red-50/30 flex flex-col justify-center items-center p-6 relative">
      <div className="absolute top-8 left-8">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-gray-900">Ride</span>
          <span className="text-[#a10d18]">Mate</span>
        </h1>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-[0.2em] mt-0.5">Admin Console</p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[400px] bg-white rounded-[24px] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Login</h2>
          <p className="text-gray-500 text-[15px] mt-2 font-medium">Manage the RideMate ecosystem</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="admin"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition text-gray-900 placeholder-gray-400 font-medium"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition text-gray-900 placeholder-gray-400 font-medium tracking-widest"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-black text-white font-bold text-[15px] py-4 rounded-xl hover:bg-gray-800 hover:scale-[1.01] active:scale-[0.98] transition-all tracking-wide shadow-md shadow-gray-200"
            >
              Login
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

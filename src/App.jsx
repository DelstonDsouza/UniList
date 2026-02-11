import "./App.css"
import { Routes, Route, useLocation, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { auth } from "./firebase"
import { onAuthStateChanged } from "firebase/auth"

import Home from "./Pages/Home"
import Login from "./Pages/Login"
import Navbar from "./Components/Navbar"
import Footer from "./Components/Footer"
import Register from "./Pages/register"
import RiderReg from "./Pages/rider"
import Dashboard from "./Pages/Dashboard"
import { Toaster } from "react-hot-toast"
import NewRide from "./Pages/NewRide"
import RiderApproval from "./Pages/RiderApproval"
import GiveRide from "./Pages/GiveRide"
import Admin from "./Pages/Admin"


function App() {
  const location = useLocation()
  const showNavbar = location.pathname !== "/dashboard"

  const RiderGate = ({ children }) => {
    const [status, setStatus] = useState("checking")
    useEffect(() => {
      let mounted = true
      const API = "http://localhost:8001"
      const check = async () => {
        try {
          const user = auth.currentUser
          const token = user ? await user.getIdToken() : null
          if (!token) {
            if (mounted) setStatus("unapproved")
            return
          }
          const res = await fetch(`${API}/rider-approval/mine`, { headers: { Authorization: `Bearer ${token}` } })
          const data = await res.json()
          const approval = data?.approval || null
          const resUser = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
          const dataUser = await resUser.json()
          const verified = !!dataUser?.user?.verified
          if (mounted) setStatus(approval && approval.status === "approved" && verified ? "approved" : "unapproved")
        } catch {
          if (mounted) setStatus("unapproved")
        }
      }
      check()
      return () => { mounted = false }
    }, [])
    if (status === "checking") return null
    if (status === "approved") return children
    return <Navigate to="/rider-approval" replace />
  }
  const AuthGate = ({ children }) => {
    const [status, setStatus] = useState("checking")
    useEffect(() => {
      const unsub = onAuthStateChanged(auth, (u) => {
        setStatus(u ? "authed" : "guest")
      })
      return () => unsub()
    }, [])
    if (status === "checking") return null
    if (status === "authed") return children
    return <Navigate to="/login" replace />
  }
  return (
    <>
    <Toaster position="top-center" reverseOrder={false} />
      {showNavbar && <Navbar />}

      <div className={showNavbar ? "pt-24" : ""}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login/rider" element={< RiderReg/>} />
          <Route path="/dashboard" element={<AuthGate><Dashboard /></AuthGate>} />
          <Route path="/new-ride/:id" element={<NewRide />} />
          <Route path="/rider-approval" element={<RiderApproval />} />
          <Route path="/giveride" element={<GiveRide />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>

      <Footer />
    </>
  )
}

export default App

import "./App.css"
import { Routes, Route, useLocation, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { getToken, apiFetch } from "./lib/api"

import Home from "./pages/Home"
import Login from "./pages/Login"
import Navbar from "./Components/Navbar"
import Footer from "./Components/Footer"
import Register from "./pages/register"
import RiderReg from "./pages/rider"
import Dashboard from "./pages/Dashboard"
import { Toaster } from "react-hot-toast"
import NewRide from "./pages/NewRide"
import GiveRide from "./pages/GiveRide"
import Admin from "./pages/Admin"
import BecomeRider from "./pages/BecomeRider"
import RiderRegistration from "./pages/RiderRegistration"
import RiderWait from "./pages/RiderWait"


function App() {
  const location = useLocation()
const showNavbar =
  !location.pathname.startsWith("/dashboard") &&
  !location.pathname.startsWith("/rider-wait")


  const AuthGate = ({ children }) => {
    const [status, setStatus] = useState("checking")
    useEffect(() => {
      const t = getToken()
      const run = async () => {
        if (!t) {
          setStatus("guest")
          return
        }
        try {
          const me = await apiFetch("/users/me")
          localStorage.setItem("user", JSON.stringify(me.user || null))
          setStatus("authed")
        } catch {
          localStorage.removeItem("user")
          setStatus("guest")
        }
      }
      run()
    }, [])
    if (status === "checking") return null
    if (status === "authed") return children
    return <Navigate to="/login" replace />
  }
  const RiderGate = ({ children }) => {
    const [ready, setReady] = useState(false)
    const [ok, setOk] = useState(false)
    useEffect(() => {
      const raw = localStorage.getItem("user")
      const u = raw ? JSON.parse(raw) : null
      setOk(!!u && !!u.isRider)
      setReady(true)
    }, [])
    if (!ready) return null
    if (!ok) return <Navigate to="/become-rider" replace />
    return children
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
          <Route path="/giveride" element={<AuthGate><RiderGate><GiveRide /></RiderGate></AuthGate>} />
          <Route
  path="/rider-wait/:id"
  element={
    <AuthGate>
      <RiderGate>
        <RiderWait />
      </RiderGate>
    </AuthGate>
  }
/>

          <Route path="/become-rider" element={<AuthGate><BecomeRider /></AuthGate>} />
          <Route path="/rider-registration" element={<AuthGate><RiderRegistration /></AuthGate>} />
        </Routes>
      </div>

      <Footer />
    </>
  )
}

export default App

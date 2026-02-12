import "./App.css"
import { Routes, Route, useLocation, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { getToken } from "./lib/api"

import Home from "./pages/Home"
import Login from "./pages/login"
import Navbar from "./Components/Navbar"
import Footer from "./Components/Footer"
import Register from "./pages/register"
import RiderReg from "./pages/rider"
import Dashboard from "./pages/Dashboard"
import { Toaster } from "react-hot-toast"
import NewRide from "./pages/NewRide"
import GiveRide from "./pages/GiveRide"
import Admin from "./pages/Admin"


function App() {
  const location = useLocation()
  const showNavbar = location.pathname !== "/dashboard"

  const AuthGate = ({ children }) => {
    const [status, setStatus] = useState("checking")
    useEffect(() => {
      const t = getToken()
      setStatus(t ? "authed" : "guest")
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
          <Route path="/giveride" element={<GiveRide />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>

      <Footer />
    </>
  )
}

export default App

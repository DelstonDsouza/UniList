// src/App.jsx
import "./App.css"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"

import RegisterDetails from "./pages/RegisterDetails"
import SelectRole from "./pages/SelectRole"

import Home from "./pages/Home"
import Login from "./pages/Login"
import Navbar from "./Components/Navbar"
import Footer from "./Components/Footer"
import Register from "./pages/register"
import RiderReg from "./pages/rider"
import { Toaster } from "react-hot-toast"
import NewRide from "./pages/NewRide"
import GiveRide from "./pages/GiveRide"
import Admin from "./pages/Admin"
import BecomeRider from "./pages/BecomeRider"
import RiderRegistration from "./pages/RiderRegistration"
import RiderWait from "./pages/RiderWait"
import RiderHome from "./pages/rider/RiderHome"
import PickLocation from "./pages/rider/PickLocation"
import PassengerHome from "./pages/passenger/PassengerHome"
import RiderSearching from "./pages/rider/RiderSearching"
import RideConfirmed from "./pages/rider/RideConfirmed"

// ── NEW IMPORTS ──────────────────────────────────────────────────────────────
import RiderOTPVerify from "./pages/rider/RiderOTPVerify"
import PassengerOTPDisplay from "./pages/passenger/PassengerOTPDisplay"
import { RideProvider } from "./context/RideContext"
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const location = useLocation()

  const showNavbar = location.pathname === "/"
  const showFooter = location.pathname === "/"

  const AuthGate = ({ children }) => {
    const [ready, setReady]   = useState(false)
    const [authed, setAuthed] = useState(false)

    useEffect(() => {
      const user = localStorage.getItem("user")
      setAuthed(!!user)
      setReady(true)
    }, [])

    if (!ready)  return null
    if (!authed) return <Navigate to="/login" replace />

    return children
  }

  return (
    // ── WRAP EVERYTHING IN RideProvider ─────────────────────────────────────
    <RideProvider>
      <Toaster position="top-center" reverseOrder={false} />

      {showNavbar && <Navbar />}
      <div className={showNavbar ? "pt-24" : ""}>

        <Routes>

          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login/rider" element={<RiderReg />} />

          {/* Onboarding */}
          <Route path="/register-details" element={<AuthGate><RegisterDetails /></AuthGate>} />
          <Route path="/select-role"       element={<AuthGate><SelectRole /></AuthGate>} />

          {/* Rider Pages */}
          <Route path="/rider-home"       element={<AuthGate><RiderHome /></AuthGate>} />
          <Route path="/pick-location"    element={<AuthGate><PickLocation /></AuthGate>} />
          <Route path="/rider-searching"  element={<AuthGate><RiderSearching /></AuthGate>} />
          <Route path="/ride-confirmed"   element={<AuthGate><RideConfirmed /></AuthGate>} />

          {/* ── NEW RIDER ROUTES ─────────────────────────────────────────── */}
          <Route path="/rider-otp-verify" element={<AuthGate><RiderOTPVerify /></AuthGate>} />
          {/* ──────────────────────────────────────────────────────────────── */}

          {/* Passenger */}
          <Route path="/passenger-home"   element={<AuthGate><PassengerHome /></AuthGate>} />

          {/* ── NEW PASSENGER ROUTES ─────────────────────────────────────── */}
          <Route path="/passenger-otp"    element={<AuthGate><PassengerOTPDisplay /></AuthGate>} />
          {/* ──────────────────────────────────────────────────────────────── */}

          {/* Other */}
          <Route path="/new-ride/:id"       element={<NewRide />} />
          <Route path="/giveride"           element={<AuthGate><GiveRide /></AuthGate>} />
          <Route path="/rider-wait/:id"     element={<AuthGate><RiderWait /></AuthGate>} />
          <Route path="/become-rider"       element={<AuthGate><BecomeRider /></AuthGate>} />
          <Route path="/rider-registration" element={<AuthGate><RiderRegistration /></AuthGate>} />

        </Routes>
      </div>

      {showFooter && <Footer />}
    </RideProvider>
  )
}

export default App
// src/App.jsx
import "./App.css"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { Toaster } from "react-hot-toast"

import Navbar from "./components/layout/Navbar"
import Footer from "./components/layout/Footer"
import { RideProvider } from "./context/RideContext"

import Login from "./pages/auth/Login"
import Register from "./pages/auth/Register"
import RegisterDetails from "./pages/auth/RegisterDetails"
import SelectRole from "./pages/auth/SelectRole"

import Home from "./pages/home/Home"

import RiderLogin from "./pages/rider/RiderLogin"
import RiderHome from "./pages/rider/RiderHome"
import PickLocation from "./pages/rider/PickLocation"
import RiderSearching from "./pages/rider/RiderSearching"
import RideConfirmed from "./pages/rider/RideConfirmed"
import RidePickup from "./pages/rider/RidePickup"
import GiveRide from "./pages/rider/GiveRide"
import RiderWait from "./pages/rider/RiderWait"
import BecomeRider from "./pages/rider/BecomeRider"
import RiderRegistration from "./pages/rider/RiderRegistration"

import PassengerHome from "./pages/passenger/PassengerHome"

import Admin from "./pages/admin/Admin"

const AuthGate = ({ children }) => {
  const [ready, setReady]   = useState(false)
  const [authed, setAuthed] = useState(false)
  useEffect(() => {
    setAuthed(!!localStorage.getItem("user"))
    setReady(true)
  }, [])
  if (!ready) return null
  if (!authed) return <Navigate to="/login" replace />
  return children
}

function App() {
  const location = useLocation()
  const isHome = location.pathname === "/"

  return (
    <RideProvider>
      <Toaster position="top-center" reverseOrder={false} />
      {isHome && <Navbar />}
      <div className={isHome ? "pt-24" : ""}>
        <Routes>
          {/* Public */}
          <Route path="/"            element={<Home />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/register"    element={<Register />} />
          <Route path="/login/rider" element={<RiderLogin />} />

          {/* Onboarding */}
          <Route path="/register-details" element={<AuthGate><RegisterDetails /></AuthGate>} />
          <Route path="/select-role"      element={<AuthGate><SelectRole /></AuthGate>} />

          {/* Rider */}
          <Route path="/rider"              element={<AuthGate><RiderHome /></AuthGate>} />
          <Route path="/rider-home"         element={<AuthGate><RiderHome /></AuthGate>} />
          <Route path="/pick-location"      element={<AuthGate><PickLocation /></AuthGate>} />
          <Route path="/rider-searching"    element={<AuthGate><RiderSearching /></AuthGate>} />
          <Route path="/ride-confirmed"     element={<AuthGate><RideConfirmed /></AuthGate>} />
          <Route path="/ride-pickup"        element={<AuthGate><RidePickup /></AuthGate>} />
          <Route path="/rider-otp-verify"   element={<Navigate to="/ride-pickup" replace />} />
          <Route path="/giveride"           element={<AuthGate><GiveRide /></AuthGate>} />
          <Route path="/rider-wait/:id"     element={<AuthGate><RiderWait /></AuthGate>} />
          <Route path="/become-rider"       element={<AuthGate><BecomeRider /></AuthGate>} />
          <Route path="/rider-registration" element={<AuthGate><RiderRegistration /></AuthGate>} />

          {/* Passenger */}
          <Route path="/passenger-home" element={<AuthGate><PassengerHome /></AuthGate>} />

          {/* Admin */}
          <Route path="/admin" element={<AuthGate><Admin /></AuthGate>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {isHome && <Footer />}
    </RideProvider>
  )
}

export default App
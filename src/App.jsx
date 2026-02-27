// src/App.jsx
import "./App.css"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { Toaster } from "react-hot-toast"

// ── Layout ──────────────────────────────────────────────────────────────────
import Navbar from "./components/layout/Navbar"
import Footer from "./components/layout/Footer"

// ── Context ─────────────────────────────────────────────────────────────────
import { RideProvider } from "./context/RideContext"

// ── Auth Pages ──────────────────────────────────────────────────────────────
import Login from "./pages/auth/Login"
import Register from "./pages/auth/Register"
import RegisterDetails from "./pages/auth/RegisterDetails"
import SelectRole from "./pages/auth/SelectRole"

// ── Home ────────────────────────────────────────────────────────────────────
import Home from "./pages/home/Home"

// ── Rider Pages ─────────────────────────────────────────────────────────────
import RiderLogin from "./pages/rider/RiderLogin"
import RiderHome from "./pages/rider/RiderHome"
import PickLocation from "./pages/rider/PickLocation"
import RiderSearching from "./pages/rider/RiderSearching"
import RideConfirmed from "./pages/rider/RideConfirmed"
import RiderOTPVerify from "./pages/rider/RiderOTPVerify"
import GiveRide from "./pages/rider/GiveRide"
import RiderWait from "./pages/rider/RiderWait"
import BecomeRider from "./pages/rider/BecomeRider"
import RiderRegistration from "./pages/rider/RiderRegistration"

// ── Passenger Pages ─────────────────────────────────────────────────────────
import PassengerHome from "./pages/passenger/PassengerHome"
import PassengerOTPDisplay from "./pages/passenger/PassengerOTPDisplay"
import NewRide from "./pages/passenger/NewRide"

// ── Admin ───────────────────────────────────────────────────────────────────
import Admin from "./pages/admin/Admin"

// ── Auth Guard ──────────────────────────────────────────────────────────────
const AuthGate = ({ children }) => {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const user = localStorage.getItem("user")
    setAuthed(!!user)
    setReady(true)
  }, [])

  if (!ready) return null
  if (!authed) return <Navigate to="/login" replace />

  return children
}

function App() {
  const location = useLocation()

  const showNavbar = location.pathname === "/"
  const showFooter = location.pathname === "/"

  return (
    <RideProvider>
      <Toaster position="top-center" reverseOrder={false} />

      {showNavbar && <Navbar />}
      <div className={showNavbar ? "pt-24" : ""}>

        <Routes>

          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login/rider" element={<RiderLogin />} />

          {/* Onboarding */}
          <Route path="/register-details" element={<AuthGate><RegisterDetails /></AuthGate>} />
          <Route path="/select-role" element={<AuthGate><SelectRole /></AuthGate>} />

          {/* Rider */}
          <Route path="/rider-home" element={<AuthGate><RiderHome /></AuthGate>} />
          <Route path="/pick-location" element={<AuthGate><PickLocation /></AuthGate>} />
          <Route path="/rider-searching" element={<AuthGate><RiderSearching /></AuthGate>} />
          <Route path="/ride-confirmed" element={<AuthGate><RideConfirmed /></AuthGate>} />
          <Route path="/rider-otp-verify" element={<AuthGate><RiderOTPVerify /></AuthGate>} />
          <Route path="/giveride" element={<AuthGate><GiveRide /></AuthGate>} />
          <Route path="/rider-wait/:id" element={<AuthGate><RiderWait /></AuthGate>} />
          <Route path="/become-rider" element={<AuthGate><BecomeRider /></AuthGate>} />
          <Route path="/rider-registration" element={<AuthGate><RiderRegistration /></AuthGate>} />

          {/* Passenger */}
          <Route path="/passenger-home" element={<AuthGate><PassengerHome /></AuthGate>} />
          <Route path="/passenger-otp" element={<AuthGate><PassengerOTPDisplay /></AuthGate>} />
          <Route path="/new-ride/:id" element={<NewRide />} />

          {/* Admin */}
          <Route path="/admin" element={<AuthGate><Admin /></AuthGate>} />

        </Routes>
      </div>

      {showFooter && <Footer />}
    </RideProvider>
  )
}

export default App
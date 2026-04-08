// src/App.jsx
import "./App.css"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { Toaster } from "react-hot-toast"
import { apiFetch } from "./services/api"
import { socket } from "./services/socket"

import { RideProvider } from "./context/RideContext"
import GlobalHelp from "./components/GlobalHelp"

import Login from "./pages/auth/Login"
import RegisterDetails from "./pages/auth/RegisterDetails"
import SelectRole from "./pages/auth/SelectRole"
import Home from "./pages/home/Home"
import RiderLogin from "./pages/rider/RiderLogin"
import RiderHome from "./pages/rider/RiderHome"
import PickLocation from "./pages/rider/PickLocation"
import RiderSearching from "./pages/rider/RiderSearching"
import RideConfirmed from "./pages/rider/RideConfirmed"
import RidePickup from "./pages/rider/RidePickup"
import RiderWait from "./pages/rider/RiderWait"
import BecomeRider from "./pages/rider/BecomeRider"
import RiderRegistration from "./pages/rider/RiderRegistration"
import PassengerHome from "./pages/passenger/PassengerHome"
import PassengerDashboard from "./pages/passenger/PassengerDashboard"
import PassengerPayment from "./pages/passenger/PassengerPayment"
import RiderPayment from "./pages/rider/RiderPayment"
import AdminLogin from "./pages/admin/AdminLogin"
import AdminDashboard from "./pages/admin/AdminDashboard"
import RaiseTicket from "./pages/shared/RaiseTicket"
import MyTickets from "./pages/shared/MyTickets"

// ✅ Defined OUTSIDE App — never recreated on re-render
const UserDisableOverlay = () => {
  const [isDisabled, setIsDisabled] = useState(false)

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return
        const res = await apiFetch("/auth/me")
        if (res?.user?.isDisabled) {
          setIsDisabled(true)
        }

        // Bind the socket for this user to get realtime updates
        if (res?.user?._id) {
          socket.emit("join:user", res.user._id)
        }
      } catch (err) {
        // ignore
      }
    }
    checkProfile()

    const handleDisabledState = ({ isDisabled }) => {
      setIsDisabled(isDisabled)
    }

    socket.on("user:disabled_state", handleDisabledState)

    return () => {
      socket.off("user:disabled_state", handleDisabledState)
    }
  }, [])

  if (!isDisabled) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] p-8 shadow-2xl max-w-sm w-full text-center border border-red-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 text-3xl font-bold">!</span>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Account Disabled</h2>
        <p className="text-[15px] font-medium text-gray-600 leading-relaxed">
          Your account has been disabled. Please contact the admin for further queries.
        </p>
      </div>
    </div>
  )
}

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
  return (
    <RideProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <UserDisableOverlay />
      <GlobalHelp />

      <Routes>

        {/* ── Public ───────────────────────────────────────────────────── */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/rider" element={<RiderLogin />} />

        {/* ── Onboarding ───────────────────────────────────────────────── */}
        <Route path="/register" element={<RegisterDetails />} />
        <Route path="/select-role" element={<AuthGate><SelectRole /></AuthGate>} />

        {/* ── Rider ────────────────────────────────────────────────────── */}
        <Route path="/rider" element={<AuthGate><RiderHome /></AuthGate>} />
        <Route path="/rider-home" element={<AuthGate><RiderHome /></AuthGate>} />

        <Route path="/pick-location" element={<AuthGate><PickLocation /></AuthGate>} />
        <Route path="/rider-searching" element={<AuthGate><RiderSearching /></AuthGate>} />
        <Route path="/ride-confirmed/:id" element={<AuthGate><RideConfirmed /></AuthGate>} />
        <Route path="/ride-pickup/:id" element={<AuthGate><RidePickup /></AuthGate>} />
        <Route path="/rider-otp-verify" element={<Navigate to="/ride-pickup" replace />} />

        <Route path="/rider-wait/:id" element={<AuthGate><RiderWait /></AuthGate>} />
        <Route path="/become-rider" element={<AuthGate><BecomeRider /></AuthGate>} />
        <Route path="/rider-registration" element={<AuthGate><RiderRegistration /></AuthGate>} />

        {/* ── Passenger ────────────────────────────────────────────────── */}
        <Route path="/passenger-home" element={<AuthGate><PassengerHome /></AuthGate>} />
        <Route path="/dashboard" element={<AuthGate><PassengerDashboard /></AuthGate>} />
        <Route path="/passenger-payment" element={<AuthGate><PassengerPayment /></AuthGate>} />

        {/* ── Rider payment (after ride complete) ──────────────────────── */}
        <Route path="/rider-payment" element={<AuthGate><RiderPayment /></AuthGate>} />

        {/* ── Help & Support ─────────────────────────────────────────── */}
        <Route path="/raise-ticket" element={<AuthGate><RaiseTicket /></AuthGate>} />
        <Route path="/my-tickets" element={<AuthGate><MyTickets /></AuthGate>} />

        {/* ── Admin ────────────────────────────────────────────────────── */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* ── Catch-all ────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </RideProvider>
  )
}

export default App
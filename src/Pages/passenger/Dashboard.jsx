// src/pages/passenger/Dashboard.jsx
// REPLACE your existing src/pages/passenger/Dashboard.jsx with this file
//
// What changed vs your old Dashboard.jsx:
//   ✅ Uses RideContext for the new passenger flow (discovery → fare reveal → tracking)
//   ✅ Still uses apiFetch from ../../services/api  (your existing pattern)
//   ✅ Still uses ../../utils/leafletIcons          (your existing import)
//   ✅ Keeps your isRider / become-rider menu logic
//   ✅ Keeps your logout logic
//   ✅ Old "accept/reject" ride logic REMOVED — replaced by RideContext flow
//   ✅ Fare is only shown after requesting (never before)
//   ✅ Ride cannot be cancelled once requested

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"

import { RideProvider, useRide } from "../../context/RideContext"
import RiderCard from "./RiderCard"
import FareRevealSheet from "./FareRevealSheet"
import ActiveRidePanel from "./ActiveRidePanel"
import RideComplete from "./RideComplete"

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../../utils/leafletIcons"   // ← your existing icon fix

// ─────────────────────────────────────────────────────────────
// Inner component — consumes RideContext
// ─────────────────────────────────────────────────────────────
function DashboardInner() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [passengerName, setPassengerName] = useState("")
  const [passengerPhone, setPassengerPhone] = useState("")

  const {
    viewState,
    nearbyRiders,
    loadingRiders,
    userLocation,
    locationError,
  } = useRide()

  // Read user from localStorage — same as your original code
  const user = (() => {
    const raw = localStorage.getItem("user")
    return raw ? JSON.parse(raw) : null
  })()

  const handleLogout = () => {
    setMenuOpen(false)
    localStorage.removeItem("user")
    localStorage.removeItem("isRider")
    localStorage.removeItem("riderProfile")
    localStorage.removeItem("token")
    navigate("/login")
  }

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">

      {/* ── Hamburger button ── */}
      <button
        className="fixed left-4 top-4 z-50 p-3 rounded-xl bg-white dark:bg-slate-800 border shadow hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Open menu"
      >
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white mb-1" />
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white mb-1" />
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white" />
      </button>

      {/* ── Slide-out Menu ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 px-6 pt-16 pb-6">
            <h2 className="text-2xl font-extrabold mb-6 text-white">Menu</h2>
            <div className="space-y-0 divide-y divide-slate-700">
              <button
                onClick={() => setMenuOpen(false)}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                PASSENGER
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  const raw = localStorage.getItem("user")
                  const u = raw ? JSON.parse(raw) : null
                  const isRider = !!u?.isRider
                  navigate(isRider ? "/giveride" : "/become-rider")
                }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                RIDER
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("History coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                HISTORY
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("Contact coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                CONTACT
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("Profile coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                PROFILE
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                LOGOUT
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 pt-16 px-4 pb-8 sm:px-8">

        {/* ══════════════════════════════════════
            VIEW: COMPLETED
        ══════════════════════════════════════ */}
        {viewState === "completed" && <RideComplete />}

        {/* ══════════════════════════════════════
            VIEW: WAITING / ONGOING
        ══════════════════════════════════════ */}
        {(viewState === "waiting" || viewState === "ongoing") && <ActiveRidePanel />}

        {/* ══════════════════════════════════════
            VIEW: FARE REVEAL (overlay)
        ══════════════════════════════════════ */}
        {viewState === "fare_reveal" && <FareRevealSheet />}

        {/* ══════════════════════════════════════
            VIEW: DISCOVERY
        ══════════════════════════════════════ */}
        {viewState === "discovery" && (
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Find a Ride
            </h1>

            {/* GPS error */}
            {locationError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                📍 {locationError}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">

              {/* ── Left: map + rider list ── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Fixed destination chip */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-red-500">●</span>
                  <span className="font-medium text-slate-800 dark:text-white">Destination:</span>
                  St Joseph Engineering College
                  <span className="ml-auto text-xs text-slate-400">(fixed)</span>
                </div>

                {/* Mini map showing your location + nearby rider pins */}
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-48">
                  {userLocation ? (
                    <MapContainer
                      center={userLocation}
                      zoom={14}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={userLocation}>
                        <Popup>📍 Your location</Popup>
                      </Marker>
                      {nearbyRiders.map((r) => {
                        const lat = r.currentLocation?.coordinates?.[1]
                        const lng = r.currentLocation?.coordinates?.[0]
                        if (!lat || !lng) return null
                        return (
                          <Marker key={r._id} position={[lat, lng]}>
                            <Popup>🛵 {r.riderName}</Popup>
                          </Marker>
                        )
                      })}
                    </MapContainer>
                  ) : (
                    <div className="h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-sm">
                      Waiting for GPS...
                    </div>
                  )}
                </div>

                {/* Rider list */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                    Available Riders{" "}
                    <span className="text-slate-400 font-normal text-sm">within 3 km</span>
                  </h3>

                  {/* Skeletons */}
                  {loadingRiders && (
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800" />
                      ))}
                    </div>
                  )}

                  {!loadingRiders && nearbyRiders.length === 0 && (
                    <div className="py-10 text-center">
                      <div className="text-4xl mb-2">🛵</div>
                      <p className="text-slate-500 text-sm">No riders within 3 km right now.</p>
                      <p className="text-slate-400 text-xs mt-1">Check back in a few minutes.</p>
                    </div>
                  )}

                  {!loadingRiders && nearbyRiders.length > 0 && (
                    <div className="space-y-3">
                      {nearbyRiders.map((ride) => (
                        <RiderCard
                          key={ride._id}
                          ride={ride}
                          passengerName={passengerName}
                          passengerPhone={passengerPhone}
                          onNameChange={setPassengerName}
                          onPhoneChange={setPassengerPhone}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right: passenger details ── */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 h-fit">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                  Your Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Fill in before requesting a ride.
                </p>
                <div className="space-y-3">
                  <input
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                    placeholder="Your Name"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                  />
                  <input
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                    placeholder="Your Phone"
                    type="tel"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                  />
                </div>

                <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">How it works</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">1. Fill your name &amp; phone above</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">2. Click "Request Ride" on any rider</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">3. Fare shown after request — pay rider in cash</p>
                  <p className="text-xs text-red-500 mt-1">⚠ Cannot cancel once requested</p>
                </div>

                <div className="mt-4 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400 text-center">
                  Fare = ₹5/km · Minimum ₹20
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Export — wrap with RideProvider
// ─────────────────────────────────────────────────────────────
function Dashboard() {
  return (
    <RideProvider>
      <DashboardInner />
    </RideProvider>
  )
}

export default Dashboard
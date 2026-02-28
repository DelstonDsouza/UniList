// src/pages/passenger/PassengerDashboard.jsx
// CREATE this new file — the complete passenger experience
// Route: /dashboard  (add to App.jsx — see instructions at bottom)

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../../utils/leafletIconFix"

import { RideProvider, useRide } from "../../context/RideContext"
import RiderCard from "./RiderCard"
import FareRevealSheet from "./FareRevealSheet"
import ActiveRidePanel from "./ActiveRidePanel"
import RideComplete from "./RideComplete"

// ─── Inner component uses context ──────────────────────────
function PassengerDashboardInner() {
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

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">

      {/* ── Hamburger ── */}
      <button
        className="fixed left-4 top-4 z-50 p-3 rounded-xl bg-white dark:bg-slate-800 border shadow hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => setMenuOpen(true)}
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
            <div className="divide-y divide-slate-700">
              <button
                onClick={() => setMenuOpen(false)}
                className="w-full text-left px-4 py-3 font-medium text-white hover:bg-slate-800 transition"
              >
                PASSENGER
              </button>
              <button
                onClick={() => { setMenuOpen(false); navigate("/giveride") }}
                className="w-full text-left px-4 py-3 font-medium text-white hover:bg-slate-800 transition"
              >
                RIDER
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("History coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white hover:bg-slate-800 transition"
              >
                HISTORY
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("Contact coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white hover:bg-slate-800 transition"
              >
                CONTACT
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("Profile coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white hover:bg-slate-800 transition"
              >
                PROFILE
              </button>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-full text-left mt-4 px-4 py-3 rounded-xl bg-slate-800 font-medium text-white transition"
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 pt-16 px-4 pb-8 sm:px-8">

        {/* ════════════════════════════════════════
            VIEW: COMPLETED
        ════════════════════════════════════════ */}
        {viewState === "completed" && <RideComplete />}

        {/* ════════════════════════════════════════
            VIEW: WAITING / ONGOING (active ride)
        ════════════════════════════════════════ */}
        {(viewState === "waiting" || viewState === "ongoing") && <ActiveRidePanel />}

        {/* ════════════════════════════════════════
            VIEW: FARE REVEAL (modal overlay)
        ════════════════════════════════════════ */}
        {viewState === "fare_reveal" && <FareRevealSheet />}

        {/* ════════════════════════════════════════
            VIEW: DISCOVERY (main listing)
        ════════════════════════════════════════ */}
        {viewState === "discovery" && (
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Find a Ride
            </h1>

            {/* GPS error banner */}
            {locationError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                📍 {locationError}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">

              {/* ── Left: Map + Rider List ── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Destination chip */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-red-500">●</span>
                  <span className="font-medium text-slate-800 dark:text-white">Destination:</span>
                  St Joseph Engineering College
                  <span className="ml-auto text-xs text-slate-400">(fixed)</span>
                </div>

                {/* Mini map */}
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
                    <span className="text-slate-400 font-normal text-sm">
                      within 3 km
                    </span>
                  </h3>

                  {/* Loading skeletons */}
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
                      <p className="text-slate-500 text-sm">No riders available within 3 km right now.</p>
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

              {/* ── Right: Passenger Details Form ── */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 h-fit">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                  Your Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Fill in your details before requesting a ride.
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
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    How it works
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    1. Fill your name &amp; phone above
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    2. Click "Request Ride" on any rider card
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    3. Fare is revealed after request — pay rider directly
                  </p>
                  <p className="text-xs text-red-500 mt-1">
                    ⚠ Rides cannot be cancelled once requested
                  </p>
                </div>

                {/* Fare formula */}
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

// ─── Wrap with provider ─────────────────────────────────────
function PassengerDashboard() {
  return (
    <RideProvider>
      <PassengerDashboardInner />
    </RideProvider>
  )
}

export default PassengerDashboard
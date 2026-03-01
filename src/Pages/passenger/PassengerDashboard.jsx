// src/pages/passenger/PassengerDashboard.jsx
import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import toast from "react-hot-toast"

import { useRide } from "../../context/RideContext"
import { apiFetch } from "../../services/api"
import FareRevealSheet from "./FareRevealSheet"
import ActiveRidePanel from "./ActiveRidePanel"
import RideComplete from "./RideComplete"

import homeIcon    from "../../assets/icons/home-icon.svg"
import exploreIcon from "../../assets/icons/explore-icon.svg"
import profileIcon from "../../assets/icons/profile-icon.svg"

import L from "leaflet"
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

function RecenterMap({ position }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!position) return
    if (prev.current?.[0] === position[0] && prev.current?.[1] === position[1]) return
    prev.current = position
    map.flyTo(position, 15, { animate: true, duration: 1.0 })
  }, [position, map])
  return null
}

function Stars({ rating = 0 }) {
  const val = parseFloat(rating) || 0
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-3 h-3 ${s <= Math.round(val) ? "text-amber-400" : "text-gray-300"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs text-gray-500 ml-1">{val > 0 ? val.toFixed(1) : "—"}</span>
    </span>
  )
}

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ── Rider Card — auto-fetches passenger profile ───────────────────────────────
function RiderCard({ ride, userLocation, onRequest, requesting, passengerProfile }) {
  const [confirming, setConfirming] = useState(false)

  const riderLat = ride.currentLocation?.coordinates?.[1]
  const riderLng = ride.currentLocation?.coordinates?.[0]
  const dist = userLocation && riderLat && riderLng
    ? distKm(userLocation[0], userLocation[1], riderLat, riderLng)
    : null

  const pickupArea = ride.pickupArea || ride.locationName || ride.collegeName || "—"

  const handleConfirm = () => {
    if (!passengerProfile) {
      toast.error("Profile not loaded yet. Try again.")
      return
    }
    const name  = `${passengerProfile.firstName} ${passengerProfile.lastName}`.trim()
    const phone = passengerProfile.phone || ""
    if (!name) {
      toast.error("Complete your profile before requesting a ride")
      return
    }
    onRequest(ride._id, name, phone)
  }

  return (
    <div className="min-w-[280px] max-w-[280px] bg-white rounded-2xl shadow-md border border-gray-100 p-4 flex flex-col gap-3 snap-start">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-base">
            {(ride.riderName || "R")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">{ride.riderName || "—"}</p>
            <p className="text-xs text-gray-500 mt-0.5">{ride.scooterNumber || "—"}</p>
          </div>
        </div>
        {dist !== null && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
            {dist.toFixed(1)} km
          </span>
        )}
      </div>

      <Stars rating={ride.rating || 0} />

      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span>📌</span>
        <span className="truncate">{pickupArea}</span>
      </div>


      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={requesting}
          className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 active:scale-95 transition disabled:opacity-50"
        >
          Accept Ride
        </button>
      ) : (
        <div className="space-y-2">
          {/* Show auto-filled passenger info — read only 
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
            <p className="text-xs text-gray-400 mb-1">Requesting as</p>
            <p className="text-sm font-semibold text-gray-800">
              {passengerProfile
                ? `${passengerProfile.firstName} ${passengerProfile.lastName}`.trim() || "—"
                : "Loading..."}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {passengerProfile?.phone || "—"}
            </p>
          </div>*/}

          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={requesting || !passengerProfile}
              className="flex-1 py-2 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition disabled:opacity-50"
            >
              {requesting ? "Locking…" : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PassengerDashboard() {
  const navigate  = useNavigate()
  const scrollRef = useRef(null)

  const {
    viewState,
    nearbyRiders,
    loadingRiders,
    userLocation,
    locationError,
    requestRide,
    requestingRideId,
  } = useRide()

  const [search,           setSearch]           = useState("")
  const [navTab,           setNavTab]           = useState("home")
  const [passengerProfile, setPassengerProfile] = useState(null)

  // ── Fetch passenger profile on mount ─────────────────────────────────────
  useEffect(() => {
    apiFetch("/auth/me")
      .then(data => setPassengerProfile(data.user))
      .catch(() => {})
  }, [])

  const filtered = search.trim().length > 0
    ? nearbyRiders.filter((r) => {
        const haystack = [
          r.locationName, r.pickupArea, r.collegeName,
          r.riderName, r.scooterNumber,
        ].join(" ").toLowerCase()
        return haystack.includes(search.toLowerCase())
      })
    : nearbyRiders

  const handleRequest = useCallback(async (rideId, name, phone) => {
    try {
      await requestRide(rideId, name, phone)
    } catch (err) {
      toast.error(err.message || "Failed to request ride")
    }
  }, [requestRide])

  if (viewState === "completed") return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <RideComplete />
      <BottomNav tab={navTab} setTab={setNavTab} navigate={navigate} />
    </div>
  )

  if (viewState === "fare_reveal") return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <FareRevealSheet />
      <BottomNav tab={navTab} setTab={setNavTab} navigate={navigate} />
    </div>
  )

  if (viewState === "waiting" || viewState === "ongoing") return (
    <div className="min-h-screen bg-gray-100 pb-24 px-4 pt-4">
      <ActiveRidePanel />
      <BottomNav tab={navTab} setTab={setNavTab} navigate={navigate} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 pb-24">

      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button className="text-2xl leading-none">☰</button>
        <h1 className="text-lg font-semibold text-gray-900">
          Welcome, {passengerProfile?.firstName || "Passenger"}!
        </h1>
        <div className="w-9 h-9 bg-teal-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {passengerProfile?.firstName?.[0]?.toUpperCase() || "P"}
        </div>
      </div>

      <div className="mx-4 rounded-3xl overflow-hidden shadow-sm" style={{ height: 200 }}>
        {userLocation ? (
          <MapContainer center={userLocation} zoom={15} style={{ height: "100%", width: "100%" }}
            dragging zoomControl scrollWheelZoom={false}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            <Marker position={userLocation} />
            <RecenterMap position={userLocation} />
            {nearbyRiders.map((r) => {
              const lat = r.currentLocation?.coordinates?.[1]
              const lng = r.currentLocation?.coordinates?.[0]
              if (!lat || !lng) return null
              return <Marker key={r._id} position={[lat, lng]} />
            })}
          </MapContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-slate-100 text-gray-400 text-sm gap-2">
            <span className="text-3xl animate-bounce">📍</span>
            <span>{locationError || "Fetching your location…"}</span>
          </div>
        )}
      </div>

      <div className="mx-4 mt-4 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Available Riders</h2>
              <p className="text-xs text-gray-400">within 3 km of you</p>
            </div>
            {!loadingRiders && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                {filtered.length} found
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by location (e.g. Vamanjoor)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="pb-4">
          {loadingRiders && (
            <div className="flex gap-3 px-4 overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="min-w-[280px] h-52 rounded-2xl bg-gray-100 animate-pulse flex-shrink-0" />
              ))}
            </div>
          )}

          {!loadingRiders && filtered.length === 0 && (
            <div className="py-10 text-center px-4">
              <div className="text-4xl mb-2">🛵</div>
              <p className="text-gray-500 text-sm font-medium">
                {search ? `No riders found near "${search}"` : "No riders available within 3 km"}
              </p>
              <p className="text-gray-400 text-xs mt-1">Check back in a few minutes</p>
            </div>
          )}

          {!loadingRiders && filtered.length > 0 && (
            <div
              ref={scrollRef}
              className="flex gap-3 px-4 overflow-x-auto snap-x snap-mandatory pb-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {filtered.map((ride) => (
                <RiderCard
                  key={ride._id}
                  ride={ride}
                  userLocation={userLocation}
                  onRequest={handleRequest}
                  requesting={requestingRideId === ride._id}
                  passengerProfile={passengerProfile}
                />
              ))}
            </div>
          )}

          {!loadingRiders && filtered.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-3 px-4">
              {filtered.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-4 mt-3 flex items-center gap-2 bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
        <span className="text-red-500 text-sm">●</span>
        <span className="text-xs text-gray-500">Destination</span>
        <span className="text-xs font-semibold text-gray-800 ml-1">St Aloysius College, Mangalore</span>
        <span className="ml-auto text-xs text-gray-400">fixed</span>
      </div>

      <BottomNav tab={navTab} setTab={setNavTab} navigate={navigate} />
    </div>
  )
}

function BottomNav({ tab, setTab, navigate }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-3 z-40 shadow-lg">
      <button
        onClick={() => { setTab("home"); navigate("/passenger-home") }}
        className={`flex flex-col items-center gap-0.5 ${tab === "home" ? "text-gray-900" : "text-gray-400"}`}
      >
        <img src={homeIcon} className={`w-6 ${tab !== "home" ? "opacity-50" : ""}`} alt="Home" />
        <span className={`text-xs ${tab === "home" ? "font-semibold" : ""}`}>Home</span>
      </button>
      <button
        onClick={() => { setTab("history"); toast.success("History coming soon") }}
        className={`flex flex-col items-center gap-0.5 ${tab === "history" ? "text-gray-900" : "text-gray-400"}`}
      >
        <img src={exploreIcon} className={`w-6 ${tab !== "history" ? "opacity-50" : ""}`} alt="History" />
        <span className={`text-xs ${tab === "history" ? "font-semibold" : ""}`}>History</span>
      </button>
      <button
        onClick={() => { setTab("account"); toast.success("Profile coming soon") }}
        className={`flex flex-col items-center gap-0.5 ${tab === "account" ? "text-gray-900" : "text-gray-400"}`}
      >
        <img src={profileIcon} className={`w-6 ${tab !== "account" ? "opacity-50" : ""}`} alt="Account" />
        <span className={`text-xs ${tab === "account" ? "font-semibold" : ""}`}>Account</span>
      </button>
    </div>
  )
}
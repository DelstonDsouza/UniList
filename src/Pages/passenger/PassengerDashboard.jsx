// src/pages/passenger/PassengerDashboard.jsx

import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import toast from "react-hot-toast"
import L from "leaflet"

import { useRide } from "../../context/RideContext"
import { apiFetch } from "../../services/api"
import FareRevealSheet from "./FareRevealSheet"
import ActiveRidePanel from "./ActiveRidePanel"
import RideComplete from "./RideComplete"

import homeIcon    from "../../assets/icons/home-icon.svg"
import exploreIcon from "../../assets/icons/explore-icon.svg"
import profileIcon from "../../assets/icons/profile-icon.svg"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ── Constants ─────────────────────────────────────────────────────────────────
const NOMINATIM   = "/nominatim"
const NOM_HEADERS = { "Accept-Language": "en", "User-Agent": "RideMateApp/1.0" }

// ── Geo helpers ───────────────────────────────────────────────────────────────
function distKm(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const extractShortName = (data) => {
  const a    = data.address || {}
  const road = a.road || ""
  const area = a.neighbourhood || a.suburb || ""
  const city = a.city || a.town || a.village || a.county || ""
  if (road && area && city) return `${road}, ${area}, ${city}`
  if (road && city)         return `${road}, ${city}`
  if (area && city)         return `${area}, ${city}`
  if (city)                 return city
  return data.display_name?.split(",").slice(0, 3).join(",").trim() ?? "Selected Location"
}

const reverseGeocode = async (lat, lng) => {
  try {
    const res  = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: NOM_HEADERS })
    const data = await res.json()
    return extractShortName(data)
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

const searchPlaces = async (query) => {
  try {
    const res  = await fetch(
      `${NOMINATIM}/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=6`,
      { headers: NOM_HEADERS }
    )
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map((x) => ({
      label: x.display_name,
      short: extractShortName(x),
      lat:   parseFloat(x.lat),
      lng:   parseFloat(x.lon),
    }))
  } catch {
    return []
  }
}

// ── Map helpers ───────────────────────────────────────────────────────────────
function RecenterMap({ position }) {
  const map  = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!position) return
    if (prev.current?.[0] === position[0] && prev.current?.[1] === position[1]) return
    prev.current = position
    map.flyTo(position, 15, { animate: true, duration: 1.0 })
  }, [position, map])
  return null
}

function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ rating = 0 }) {
  const val = parseFloat(rating) || 0
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-4 h-4 ${s <= Math.round(val) ? "text-amber-400" : "text-gray-300"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-sm text-gray-500 ml-1">{val > 0 ? val.toFixed(1) : "—"}</span>
    </span>
  )
}

// ── Rider Card ────────────────────────────────────────────────────────────────
function RiderCard({ ride, passengerLocation, onRequest, requesting, passengerProfile }) {
  const [confirming, setConfirming] = useState(false)

  const riderLat = ride.currentLocation?.coordinates?.[1]
  const riderLng = ride.currentLocation?.coordinates?.[0]
  const dist = passengerLocation && riderLat && riderLng
    ? distKm(passengerLocation[0], passengerLocation[1], riderLat, riderLng)
    : null

  const pickupArea = ride.locationName || ride.pickupArea || "—"

  const handleConfirm = () => {
    if (!passengerProfile) { toast.error("Profile not loaded yet."); return }
    const name  = `${passengerProfile.firstName} ${passengerProfile.lastName}`.trim()
    const phone = passengerProfile.phone || ""
    if (!name) { toast.error("Complete your profile before requesting a ride"); return }
    onRequest(ride._id, name, phone)
  }

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg">
            {(ride.riderName || "R")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-base">{ride.riderName || "—"}</p>
            <Stars rating={ride.rating || 0} />
          </div>
        </div>
        {dist !== null && (
          <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
            {dist.toFixed(1)} km away
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
        <span>📍</span>
        <span className="font-medium">{pickupArea}</span>
      </div>

      {!confirming ? (
        <button onClick={() => setConfirming(true)} disabled={requesting}
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-base font-semibold hover:bg-gray-700 active:scale-95 transition disabled:opacity-50">
          Accept Ride
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-base font-medium hover:bg-gray-50 transition">
            Back
          </button>
          <button onClick={handleConfirm} disabled={requesting || !passengerProfile}
            className="flex-1 py-3 rounded-xl bg-teal-500 text-white text-base font-semibold hover:bg-teal-600 transition disabled:opacity-50">
            {requesting ? "Locking…" : "Confirm"}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PassengerDashboard() {
  const navigate = useNavigate()

  const {
    viewState, nearbyRiders, loadingRiders,
    userLocation, locationError, requestRide, requestingRideId,
  } = useRide()

  const [search,           setSearch]           = useState("")
  const [navTab,           setNavTab]           = useState("home")
  const [passengerProfile, setPassengerProfile] = useState(null)

  // ── Passenger location state (separate from RideContext GPS) ──────────────
  const [passengerLocation, setPassengerLocation] = useState(null) // [lat, lng]
  const [locationName,      setLocationName]      = useState("")
  const [suggestions,       setSuggestions]       = useState([])
  const [showDrop,          setShowDrop]          = useState(false)
  const [loadingSugg,       setLoadingSugg]       = useState(false)
  const [showMapPicker,     setShowMapPicker]     = useState(false)

  const isUserTyping = useRef(false)
  const debTimer     = useRef(null)
  const dropRef      = useRef(null)

  // ── Fetch profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/auth/me")
      .then(data => setPassengerProfile(data.user))
      .catch(() => {})
  }, [])

  // ── Auto-set location from RideContext GPS on first load ──────────────────
  useEffect(() => {
    if (!userLocation || passengerLocation) return
    setPassengerLocation(userLocation)
    reverseGeocode(userLocation[0], userLocation[1]).then(setLocationName)
  }, [userLocation])

  // ── Autocomplete ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isUserTyping.current) return
    clearTimeout(debTimer.current)
    const q = locationName.trim()
    if (q.length < 3) { setSuggestions([]); setShowDrop(false); setLoadingSugg(false); return }
    setLoadingSugg(true)
    debTimer.current = setTimeout(async () => {
      const items = await searchPlaces(q)
      setSuggestions(items)
      setShowDrop(items.length > 0)
      setLoadingSugg(false)
    }, 350)
    return () => clearTimeout(debTimer.current)
  }, [locationName])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const selectSuggestion = (item) => {
    isUserTyping.current = false
    setLocationName(item.short || item.label.split(",")[0])
    setPassengerLocation([item.lat, item.lng])
    setSuggestions([])
    setShowDrop(false)
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocationName("Fetching location…")
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = [pos.coords.latitude, pos.coords.longitude]
        setPassengerLocation(loc)
        const name = await reverseGeocode(loc[0], loc[1])
        isUserTyping.current = false
        setLocationName(name)
      },
      () => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const loc = [pos.coords.latitude, pos.coords.longitude]
            setPassengerLocation(loc)
            const name = await reverseGeocode(loc[0], loc[1])
            isUserTyping.current = false
            setLocationName(name)
          },
          () => setLocationName(""),
          { enableHighAccuracy: false, timeout: 15000 }
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleMapPick = async ([lat, lng]) => {
    setPassengerLocation([lat, lng])
    setLocationName("Getting address…")
    const name = await reverseGeocode(lat, lng)
    isUserTyping.current = false
    setLocationName(name)
    setShowMapPicker(false)
  }

  const filtered = search.trim()
    ? nearbyRiders.filter((r) =>
        [r.locationName, r.pickupArea, r.riderName]
          .join(" ").toLowerCase()
          .includes(search.toLowerCase())
      )
    : nearbyRiders

  // ✅ Fix: pass passengerLocation as 4th argument to requestRide
  const handleRequest = useCallback(async (rideId, name, phone) => {
    try { await requestRide(rideId, name, phone, passengerLocation) }
    catch (err) { toast.error(err.message || "Failed to request ride") }
  }, [requestRide, passengerLocation])  // ✅ passengerLocation in deps

  // ── View state routing ────────────────────────────────────────────────────
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

  const mapCenter = passengerLocation || userLocation

  return (
    <div className="min-h-screen bg-gray-100 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button className="text-2xl leading-none">☰</button>
        <h1 className="text-lg font-semibold text-gray-900">
          Welcome, {passengerProfile?.firstName || "Passenger"}!
        </h1>
        <div className="w-9 h-9 bg-teal-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {passengerProfile?.firstName?.[0]?.toUpperCase() || "P"}
        </div>
      </div>

      {/* Location picker */}
      <div className="mx-4 mb-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400 font-medium mb-2">Your pickup location</p>

          {/* Textbox with dropdown */}
          <div className="relative" ref={dropRef}>
            <input
              type="text"
              value={locationName}
              onChange={(e) => {
                isUserTyping.current = true
                setLocationName(e.target.value)
              }}
              onFocus={() => { if (suggestions.length > 0) setShowDrop(true) }}
              placeholder="Type your location…"
              className="w-full p-3 rounded-xl bg-gray-100 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {loadingSugg && (
              <span className="absolute right-3 top-3.5 text-gray-400 animate-spin select-none">⟳</span>
            )}
            {showDrop && suggestions.length > 0 && (
              <ul className="absolute z-50 left-0 right-0 mt-1 bg-white text-black border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <li key={`${s.lat}-${s.lng}-${i}`} className="border-b border-gray-100 last:border-0">
                    <button type="button" onMouseDown={() => selectSuggestion(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition">
                      <span className="block font-medium text-sm">{s.short}</span>
                      <span className="block text-xs text-gray-400 truncate">{s.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-2">
            <button onClick={useCurrentLocation}
              className="flex items-center gap-1.5 text-xs text-teal-600 font-medium bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition">
              📍 Use current location
            </button>
            <button onClick={() => setShowMapPicker(p => !p)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition
                ${showMapPicker ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              🗺 {showMapPicker ? "Hide map" : "Pick on map"}
            </button>
          </div>
        </div>
      </div>

      {/* Map — toggleable picker or standard view */}
      <div className="mx-4 rounded-3xl overflow-hidden shadow-sm" style={{ height: showMapPicker ? 260 : 180 }}>
        {mapCenter ? (
          <MapContainer center={mapCenter} zoom={15} style={{ height: "100%", width: "100%" }}
            dragging zoomControl scrollWheelZoom={false}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            {passengerLocation && <Marker position={passengerLocation} />}
            <RecenterMap position={passengerLocation} />
            {showMapPicker && <MapClickHandler onPick={handleMapPick} />}
          </MapContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-slate-100 text-gray-400 text-sm gap-2">
            <span className="text-3xl animate-bounce">📍</span>
            <span>{locationError || "Fetching your location…"}</span>
          </div>
        )}
      </div>
      {showMapPicker && (
        <p className="text-center text-xs text-gray-400 mt-1 mx-4">
          Tap anywhere on the map to set your pickup location
        </p>
      )}

      {/* Riders list */}
      <div className="mx-4 mt-4 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Available Riders</h2>
              <p className="text-sm text-gray-400">on your route to college</p>
            </div>
            {!loadingRiders && (
              <span className="text-sm font-semibold px-3 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                {filtered.length} found
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search by location or name" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 flex flex-col gap-3 max-h-[55vh] overflow-y-auto">
          {loadingRiders && [1, 2].map((i) => (
            <div key={i} className="w-full h-36 rounded-2xl bg-gray-100 animate-pulse" />
          ))}

          {!loadingRiders && filtered.length === 0 && (
            <div className="py-10 text-center">
              <div className="text-4xl mb-2">🛵</div>
              <p className="text-gray-500 text-base font-medium">
                {search ? `No riders found for "${search}"` : "No riders on your route yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">Check back in a few minutes</p>
            </div>
          )}

          {!loadingRiders && filtered.map((ride) => (
            <RiderCard
              key={ride._id}
              ride={ride}
              passengerLocation={passengerLocation}
              onRequest={handleRequest}
              requesting={requestingRideId === ride._id}
              passengerProfile={passengerProfile}
            />
          ))}
        </div>
      </div>

      <BottomNav tab={navTab} setTab={setNavTab} navigate={navigate} />
    </div>
  )
}

function BottomNav({ tab, setTab, navigate }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-3 z-40 shadow-lg">
      <button onClick={() => { setTab("home"); navigate("/passenger-home") }}
        className={`flex flex-col items-center gap-0.5 ${tab === "home" ? "text-gray-900" : "text-gray-400"}`}>
        <img src={homeIcon} className={`w-6 ${tab !== "home" ? "opacity-50" : ""}`} alt="Home" />
        <span className={`text-xs ${tab === "home" ? "font-semibold" : ""}`}>Home</span>
      </button>
      <button onClick={() => { setTab("history"); toast.success("History coming soon") }}
        className={`flex flex-col items-center gap-0.5 ${tab === "history" ? "text-gray-900" : "text-gray-400"}`}>
        <img src={exploreIcon} className={`w-6 ${tab !== "history" ? "opacity-50" : ""}`} alt="History" />
        <span className={`text-xs ${tab === "history" ? "font-semibold" : ""}`}>History</span>
      </button>
      <button onClick={() => { setTab("account"); toast.success("Profile coming soon") }}
        className={`flex flex-col items-center gap-0.5 ${tab === "account" ? "text-gray-900" : "text-gray-400"}`}>
        <img src={profileIcon} className={`w-6 ${tab !== "account" ? "opacity-50" : ""}`} alt="Account" />
        <span className={`text-xs ${tab === "account" ? "font-semibold" : ""}`}>Account</span>
      </button>
    </div>
  )
}
// src/pages/passenger/PassengerDashboard.jsx

import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import toast from "react-hot-toast"
import L from "leaflet"
import { signOut } from "firebase/auth"
import { auth } from "../../config/firebase"

import { useRide } from "../../context/RideContext"
import { apiFetch } from "../../services/api"
import FareRevealSheet from "./FareRevealSheet"
import ActiveRidePanel from "./ActiveRidePanel"
import UpcomingRide    from "./UpcomingRide"
import RideComplete    from "./RideComplete"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const NOMINATIM   = "/nominatim"
const NOM_HEADERS = { "Accept-Language": "en", "User-Agent": "RideMateApp/1.0" }

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

// ── Reusable UI pieces ────────────────────────────────────────────────────────

function Avatar({ name, size = "sm" }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "P"
  const sz = size === "lg" ? "w-16 h-16 text-xl" : "w-9 h-9 text-sm"
  return (
    <div className={`${sz} rounded-full bg-teal-600 flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
    cancelled: { bg: "bg-red-100",   text: "text-red-600",   label: "Cancelled" },
    active:    { bg: "bg-blue-100",  text: "text-blue-700",  label: "Active"    },
  }
  const s = map[status?.toLowerCase()] || { bg: "bg-gray-100", text: "text-gray-600", label: status }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value || "—"}</p>
      </div>
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
      <p className="text-base font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}

function NavTab({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 px-4">
      <span className={`text-xl transition-transform ${active ? "scale-110" : "opacity-40"}`}>{icon}</span>
      <span className={`text-xs font-medium transition-colors ${active ? "text-teal-600" : "text-gray-400"}`}>
        {label}
      </span>
      {active && <div className="w-1 h-1 rounded-full bg-teal-500 mt-0.5" />}
    </button>
  )
}

function BottomNav({ tab, setTab }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-3 z-40 shadow-lg">
      <NavTab icon="🏠" label="Home"    active={tab === "home"}    onClick={() => setTab("home")} />
      <NavTab icon="📋" label="History" active={tab === "history"} onClick={() => setTab("history")} />
      <NavTab icon="👤" label="Account" active={tab === "account"} onClick={() => setTab("account")} />
    </div>
  )
}

// ── Header — defined OUTSIDE main component to prevent remount on state change ──
function Header({ firstName, fullName, showDropdown, setShowDropdown, dropdownRef, setNavTab, setShowRiderModal, handleLogout }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-3 bg-white shadow-sm">
      <h1 className="text-lg font-bold text-gray-900">
        Welcome, <span className="text-teal-600">{firstName}</span>!
      </h1>
      <div className="relative" ref={dropdownRef}>
        <button onClick={() => setShowDropdown(v => !v)} className="focus:outline-none">
          <Avatar name={fullName || firstName} />
        </button>
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 z-[9999] overflow-hidden">
            <button
              onClick={() => { setShowDropdown(false); setNavTab("account") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
            >
              <span>👤</span> View Profile
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={() => { setShowDropdown(false); setShowRiderModal(true) }}
              className="w-full text-left px-4 py-3 text-sm text-teal-700 hover:bg-teal-50 flex items-center gap-2 transition"
            >
              <span>🛵</span> Be a Rider
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 transition"
            >
              <span>🚪</span> Logout
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Be a Rider modal ──────────────────────────────────────────────────────────
function BeARiderModal({ onClose, onSubmit, loading }) {
  const [licenseNo, setLicenseNo] = useState("")
  const [vehicleNo, setVehicleNo] = useState("")

  const handleSubmit = () => {
    if (!licenseNo.trim() || !vehicleNo.trim()) {
      toast.error("Please fill in both fields")
      return
    }
    onSubmit({ licenseNo: licenseNo.trim().toUpperCase(), vehicleNo: vehicleNo.trim().toUpperCase() })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Become a Rider</h2>
            <p className="text-xs text-gray-400 mt-0.5">Register your vehicle to start giving rides</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-600 font-bold">
            ✕
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">🪪 Driving License Number</label>
            <input type="text" value={licenseNo}
              onChange={e => setLicenseNo(e.target.value.toUpperCase())}
              placeholder="e.g. KA05 20210012345"
              className="w-full bg-gray-100 p-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">🚗 Vehicle Number Plate</label>
            <input type="text" value={vehicleNo}
              onChange={e => setVehicleNo(e.target.value.toUpperCase())}
              placeholder="e.g. KA 19 AB 1234"
              className="w-full bg-gray-100 p-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition">
            {loading ? "Submitting…" : "Register as Rider"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rider card ────────────────────────────────────────────────────────────────
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

  const [navTab,            setNavTab]            = useState("home")
  const [passengerProfile,  setPassengerProfile]  = useState(null)
  const [passengerLocation, setPassengerLocation] = useState(null)
  const [locationName,      setLocationName]      = useState("")
  const [suggestions,       setSuggestions]       = useState([])
  const [showDrop,          setShowDrop]          = useState(false)
  const [loadingSugg,       setLoadingSugg]       = useState(false)
  const [showMapPicker,     setShowMapPicker]     = useState(false)
  const [search,            setSearch]            = useState("")
  const [showDropdown,      setShowDropdown]      = useState(false)
  const [showRiderModal,    setShowRiderModal]    = useState(false)
  const [riderRegLoading,   setRiderRegLoading]   = useState(false)
  const [history,           setHistory]           = useState([])
  const [historyLoad,       setHistoryLoad]       = useState(false)
  const [historyErr,        setHistoryErr]        = useState("")
  const [editMode,          setEditMode]          = useState(false)
  const [editEmail,         setEditEmail]         = useState("")
  const [editLoading,       setEditLoading]       = useState(false)
  const [editMsg,           setEditMsg]           = useState("")

  const isUserTyping = useRef(false)
  const debTimer     = useRef(null)
  const dropRef      = useRef(null)
  const dropdownRef  = useRef(null)
  const storedUser   = JSON.parse(localStorage.getItem("user") || "{}")

  // Load profile
  useEffect(() => {
    apiFetch("/auth/me")
      .then(data => setPassengerProfile(data.user || data))
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Location from context
  useEffect(() => {
    if (!userLocation || passengerLocation) return
    setPassengerLocation(userLocation)
    reverseGeocode(userLocation[0], userLocation[1]).then(setLocationName)
  }, [userLocation])

  // Autocomplete
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

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Load history when tab opens
  useEffect(() => {
    if (navTab !== "history") return
    setHistoryLoad(true)
    setHistoryErr("")
    const userId = passengerProfile?._id || storedUser?.uid || ""
    apiFetch(`/rides/history?passengerId=${userId}`)
      .then(data => setHistory(Array.isArray(data.rides) ? data.rides : []))
      .catch(() => setHistoryErr("Could not load ride history."))
      .finally(() => setHistoryLoad(false))
  }, [navTab, passengerProfile])

  const handleLogout = useCallback(async () => {
    try { await signOut(auth) } catch {}
    localStorage.clear()
    navigate("/login", { replace: true })
  }, [navigate])

  const handleRiderRegister = async ({ licenseNo, vehicleNo }) => {
    setRiderRegLoading(true)
    try {
      await apiFetch("/rider/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ licenseNo, vehicleNo }),
      })
      toast.success("Rider registration submitted!")
      setShowRiderModal(false)
      navigate("/become-rider")
    } catch (err) {
      toast.error(err.message || "Registration failed")
    } finally {
      setRiderRegLoading(false)
    }
  }

  const handleEditSave = async () => {
    if (!editEmail.trim()) return
    setEditLoading(true); setEditMsg("")
    try {
      await apiFetch("/auth/profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: editEmail.trim().toLowerCase() }),
      })
      setPassengerProfile(prev => ({ ...prev, email: editEmail.trim().toLowerCase() }))
      setEditMsg("Email updated successfully!")
      setEditMode(false)
    } catch (err) {
      setEditMsg(err.message || "Failed to update email.")
    } finally {
      setEditLoading(false)
    }
  }

  const selectSuggestion = (item) => {
    isUserTyping.current = false
    setLocationName(item.short || item.label.split(",")[0])
    setPassengerLocation([item.lat, item.lng])
    setSuggestions([]); setShowDrop(false)
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocationName("Fetching location…")
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = [pos.coords.latitude, pos.coords.longitude]
        setPassengerLocation(loc)
        const name = await reverseGeocode(loc[0], loc[1])
        isUserTyping.current = false; setLocationName(name)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleMapPick = async ([lat, lng]) => {
    setPassengerLocation([lat, lng])
    setLocationName("Getting address…")
    const name = await reverseGeocode(lat, lng)
    isUserTyping.current = false; setLocationName(name)
    setShowMapPicker(false)
  }

  const filtered = search.trim()
    ? nearbyRiders.filter((r) =>
        [r.locationName, r.pickupArea, r.riderName].join(" ").toLowerCase().includes(search.toLowerCase())
      )
    : nearbyRiders

  const handleRequest = useCallback(async (rideId, name, phone) => {
    try { await requestRide(rideId, name, phone, passengerLocation) }
    catch (err) { toast.error(err.message || "Failed to request ride") }
  }, [requestRide, passengerLocation])

  const firstName = passengerProfile?.firstName || storedUser?.firstName || "Passenger"
  const fullName  = passengerProfile
    ? `${passengerProfile.firstName || ""} ${passengerProfile.lastName || ""}`.trim()
    : ""

  const formatDate = (dateStr) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  }

  // shared header props
  const headerProps = {
    firstName, fullName, showDropdown, setShowDropdown,
    dropdownRef, setNavTab, setShowRiderModal, handleLogout,
  }

  const mapCenter = passengerLocation || userLocation

  // ── View state routing ─────────────────────────────────────────────────────
  if (viewState === "completed") return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <Header {...headerProps} />
      <RideComplete />
      <BottomNav tab={navTab} setTab={setNavTab} />
    </div>
  )
  if (viewState === "fare_reveal") return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <Header {...headerProps} />
      <FareRevealSheet />
      <BottomNav tab={navTab} setTab={setNavTab} />
    </div>
  )
  if (viewState === "confirmed") return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <Header {...headerProps} />
      <UpcomingRide />
      <BottomNav tab={navTab} setTab={setNavTab} />
    </div>
  )
  if (viewState === "pickup_started" || viewState === "waiting" || viewState === "ongoing") return (
    <div className="min-h-screen bg-gray-100 pb-24 px-4 pt-4">
      <Header {...headerProps} />
      <ActiveRidePanel />
      <BottomNav tab={navTab} setTab={setNavTab} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 pb-24">

      {showRiderModal && (
        <BeARiderModal
          onClose={() => setShowRiderModal(false)}
          onSubmit={handleRiderRegister}
          loading={riderRegLoading}
        />
      )}

      <Header {...headerProps} />

      {/* ══════════════════ HOME TAB ══════════════════ */}
      {navTab === "home" && (
        <>
          <div className="mx-4 mt-4 mb-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 font-medium mb-2">Your pickup location</p>
              <div className="relative" ref={dropRef}>
                <input type="text" value={locationName}
                  onChange={(e) => { isUserTyping.current = true; setLocationName(e.target.value) }}
                  onFocus={() => { if (suggestions.length > 0) setShowDrop(true) }}
                  placeholder="Type your location…"
                  className="w-full p-3 rounded-xl bg-gray-100 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                {loadingSugg && <span className="absolute right-3 top-3.5 text-gray-400 animate-spin select-none">⟳</span>}
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

          <div className="mx-4 rounded-3xl overflow-hidden shadow-sm" style={{ height: showMapPicker ? 260 : 180, zIndex: 10 }}>
            {mapCenter ? (
              <MapContainer center={mapCenter} zoom={15} style={{ height: "100%", width: "100%" }}
                dragging zoomControl scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>' />
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
        </>
      )}

      {/* ══════════════════ HISTORY TAB ══════════════════ */}
      {navTab === "history" && (
        <div className="px-4 pt-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Ride History</h2>
          {historyLoad && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {historyErr && <div className="text-center py-16 text-red-500 text-sm">{historyErr}</div>}
          {!historyLoad && !historyErr && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <span className="text-5xl mb-3">🛵</span>
              <p className="text-sm font-medium">No rides yet</p>
              <p className="text-xs mt-1">Your completed rides will appear here</p>
            </div>
          )}
          <div className="space-y-3">
            {history.map((ride, i) => (
              <div key={ride._id || i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">{formatDate(ride.createdAt || ride.date)}</p>
                    <p className="text-xs text-gray-400">{ride.departureTime || ""}</p>
                  </div>
                  <StatusBadge status={ride.status} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pickup</p>
                      <p className="text-sm font-medium text-gray-800">{ride.pickupLocation || ride.userLocation || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Destination</p>
                      <p className="text-sm font-medium text-gray-800">{ride.destination || "St Aloysius College, Mangalore"}</p>
                    </div>
                  </div>
                </div>
                {ride.fare != null && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Fare Paid</span>
                    <span className="text-sm font-bold text-teal-600">₹{ride.fare}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════ ACCOUNT TAB ══════════════════ */}
      {navTab === "account" && (
        <div className="px-4 pt-5 pb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Account</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-4">
                <Avatar name={fullName || firstName} size="lg" />
                <div>
                  <p className="font-bold text-gray-900 text-base">{fullName || firstName}</p>
                  <p className="text-xs text-teal-600 font-medium mt-0.5">Passenger</p>
                </div>
              </div>
              <div className="space-y-3">
                <InfoRow icon="🎓" label="University ID" value={passengerProfile?.universityId} />
                <InfoRow icon="📧" label="Email"         value={passengerProfile?.email} />
                <InfoRow icon="📱" label="Phone"         value={passengerProfile?.phone || storedUser?.phone} />
                <InfoRow icon="⚥"  label="Gender"        value={passengerProfile?.gender} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-700 mb-3">Ride Statistics</p>
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Total Rides" value={passengerProfile?.totalRides ?? history.length ?? "—"} />
                <StatBox label="Total Spent"  value={passengerProfile?.totalSpent ? `₹${passengerProfile.totalSpent}` : "—"} />
                <StatBox label="Rating"       value={passengerProfile?.rating ? `${passengerProfile.rating} ⭐` : "—"} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-700 mb-3">Edit Profile</p>
              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">New Email</label>
                    <input type="email" value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-gray-100 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  {editMsg && (
                    <p className={`text-xs ${editMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                      {editMsg}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setEditMode(false); setEditMsg("") }}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
                      Cancel
                    </button>
                    <button onClick={handleEditSave} disabled={editLoading}
                      className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition">
                      {editLoading ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setEditMode(true); setEditEmail(passengerProfile?.email || "") }}
                  className="w-full py-2.5 rounded-xl border border-teal-500 text-teal-600 text-sm font-medium hover:bg-teal-50 transition">
                  ✏️ Edit Email
                </button>
              )}
            </div>

            <button onClick={() => setShowRiderModal(true)}
              className="w-full py-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 font-semibold text-sm hover:bg-teal-100 transition">
              🛵 Become a Rider
            </button>

            <button onClick={handleLogout}
              className="w-full py-3 rounded-2xl bg-red-50 border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-100 transition">
              🚪 Logout
            </button>
          </div>
        </div>
      )}

      <BottomNav tab={navTab} setTab={setNavTab} />
    </div>
  )
}
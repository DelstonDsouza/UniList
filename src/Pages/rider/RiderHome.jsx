import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { signOut } from "firebase/auth"
import { auth } from "../../config/firebase"
import { apiFetch } from "../../services/api"
import toast from "react-hot-toast"
import { Compass, Clock, User } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useRide } from "../../context/RideContext"

import L from "leaflet"
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ── Map helpers ──────────────────────────────────────────────────────────────

function RecenterMap({ position }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!position) return
    if (prev.current?.[0] === position[0] && prev.current?.[1] === position[1]) return
    prev.current = position
    map.flyTo(position, 16, { animate: true, duration: 1.0 })
  }, [position, map])
  return null
}

function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

const NOMINATIM = "/nominatim"
const NOM_HEADERS = { "Accept-Language": "en", "User-Agent": "RideMateApp/1.0" }

const geoCache = new Map()

const extractShortName = (data) => {
  const a = data.address || {}
  const road = a.road || a.pedestrian || a.suburb || ""
  const neighborhood = a.neighbourhood || a.village || a.hamlet || ""
  const city = a.city || a.town || a.city_district || ""

  const parts = [road, neighborhood, city].filter(Boolean)
  if (parts.length >= 2) return parts.slice(0, 2).join(", ")
  if (parts.length === 1) return parts[0]

  return data.display_name?.split(",").slice(0, 2).join(", ").trim() ?? "Selected Location"
}

const reverseGeocode = async (lat, lng) => {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (geoCache.has(key)) return geoCache.get(key)

  try {
    const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { ...NOM_HEADERS, "User-Agent": "RideMateApp/Client-1.1" },
      signal: AbortSignal.timeout(5000)
    })
    const data = await res.json()
    const name = extractShortName(data)
    geoCache.set(key, name)
    return name
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

const searchPlaces = async (query) => {
  try {
    const res = await fetch(
      `${NOMINATIM}/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=6`,
      { headers: NOM_HEADERS }
    )
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map((x) => ({
      label: x.display_name,
      short: extractShortName(x),
      lat: parseFloat(x.lat),
      lng: parseFloat(x.lon),
    }))
  } catch {
    return []
  }
}

const formatTime = (t) => {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

const getMinTime = () => {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
    cancelled: { bg: "bg-red-100", text: "text-red-600", label: "Cancelled" },
    active: { bg: "bg-blue-100", text: "text-blue-700", label: "Active" },
  }
  const s = map[status?.toLowerCase()] || { bg: "bg-gray-100", text: "text-gray-600", label: status }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function Avatar({ name, size = "md", src }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "R"
  const sz = size === "lg" ? "w-16 h-16 text-xl" : "w-10 h-10 text-sm"
  return (
    <div className={`${sz} rounded-full bg-teal-50 border-2 border-white flex items-center justify-center text-teal-600 font-bold flex-shrink-0 shadow-sm overflow-hidden`}>
      {src ? <img src={src} className="w-full h-full object-cover" alt="Avatar" /> : initials}
    </div>
  )
}

export default function RiderHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { riderActiveRide, setRiderRideActive, hasActiveRide } = useRide()
  const [tab, setTab] = useState(location.state?.tab || "home")
  const [accountView, setAccountView] = useState(location.state?.accountView || "menu")
  
  // Keep history state in sync so refreshes maintain the current tab
  useEffect(() => {
    navigate(".", { replace: true, state: { from: location.state?.from, tab, accountView } })
  }, [tab, accountView, navigate, location.state?.from])

  const [statFilter, setStatFilter] = useState("7 Days")
  const [uploadingPic, setUploadingPic] = useState(false)

  // ── User info ─────────────────────────────────────────────────────────────
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}")
  const [profile, setProfile] = useState(null)
  const [profileLoad, setProfileLoad] = useState(true)
  const [showSwitchPassengerConfirm, setShowSwitchPassengerConfirm] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  // \u2500\u2500 REDIRECT IF RIDE IS ACTIVE \u2500\u2500
  useEffect(() => {
    if (tab === "home" && riderActiveRide) {
      console.log("🚀 Ride active, redirecting to ride page...")
      const navState = {
        rideId: riderActiveRide._id,
        passengerName: riderActiveRide.passenger?.name || "Passenger",
        passengerPhone: riderActiveRide.passenger?.phone || "",
        passengerPickup: riderActiveRide.passenger?.location?.coordinates
          ? [riderActiveRide.passenger.location.coordinates[1], riderActiveRide.passenger.location.coordinates[0]]
          : null,
        fare: riderActiveRide.fare?.amount,
        distanceKm: riderActiveRide.fare?.distanceKm,
      }
      if (riderActiveRide.status === "pending" || riderActiveRide.status === "waiting") {
        navigate(`/rider-wait/${riderActiveRide._id}`, { state: navState, replace: true })
      } else if (riderActiveRide.status === "locked" || riderActiveRide.status === "confirmed") {
        navigate(`/ride-confirmed/${riderActiveRide._id}`, { state: navState, replace: true })
      } else if (["ongoing", "pickup_started", "arrived"].includes(riderActiveRide.status)) {
        navigate(`/ride-pickup/${riderActiveRide._id}`, { state: navState, replace: true })
      }
    }
  }, [tab, riderActiveRide, navigate])

  useEffect(() => {
    apiFetch("/auth/me")
      .then(data => setProfile(data.user || data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoad(false))
  }, [])

  const firstName = profile?.firstName || storedUser?.firstName || "Rider"
  const fullName = profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : ""

  // ── Profile dropdown ──────────────────────────────────────────────────────
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleLogout = async () => {
    try { await signOut(auth) } catch { }
    localStorage.clear()
    navigate("/login", { replace: true })
  }

  // ── Active Ride — synced from global context ──────────────────────────────
  // Refetch on home tab to pick up any missed updates
  useEffect(() => {
    if (tab !== "home" || !profile) return
    apiFetch("/rides/my")
      .then(data => {
        const rides = data?.data?.rides || []
        const latest = rides.find(r =>
          ["pending", "locked", "pickup_started", "ongoing"].includes(r.status)
        )
        setRiderRideActive(latest || null)
      })
      .catch(() => { })
  }, [tab, profile])

  // ── History ───────────────────────────────────────────────────────────────
  const [history, setHistory] = useState([])
  const [historyLoad, setHistoryLoad] = useState(false)
  const [historyErr, setHistoryErr] = useState("")

  useEffect(() => {
    if (tab !== "history") return
    setHistoryLoad(true)
    setHistoryErr("")
    const userId = profile?._id || storedUser?.uid || ""
    apiFetch(`/rides/history?riderId=${userId}`)
      .then(res => {
        const arr = res?.data?.rides || res?.rides
        setHistory(Array.isArray(arr) ? arr : [])
      })
      .catch(() => setHistoryErr("Could not load ride history."))
      .finally(() => setHistoryLoad(false))
  }, [tab, profile])

  // ── Saved rides ───────────────────────────────────────────────────────────
  const [saveNotification, setSaveNotification] = useState("")
  const saveNotifTimer = useRef(null)

  const showSaveNotification = (msg) => {
    setSaveNotification(msg)
    if (saveNotifTimer.current) clearTimeout(saveNotifTimer.current)
    saveNotifTimer.current = setTimeout(() => {
      setSaveNotification("")
    }, 2500)
  }

  const [savedRides, setSavedRides] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("savedRides") || "[]")
      return Array.isArray(saved) ? saved : []
    } catch { return [] }
  })

  const loadSavedRide = (saved) => {
    if (!saved) return
    applyPin(saved.pickupLat, saved.pickupLng)
    if (saved.departureTime) setDepartureTime(saved.departureTime)
    // Destination is fixed as collegeName in this app
    setTab("home")
  }

  const isCurrentRideSaved = () => pinCoords && savedRides.some(r =>
    r.pickupLat === pinCoords[0] &&
    r.pickupLng === pinCoords[1] &&
    r.departureTime === departureTime
  )

  const saveCurrentRide = () => {
    if (!pinCoords) {
      showSaveNotification("Please select a pickup location first")
      return
    }
    if (isCurrentRideSaved()) {
      const updated = savedRides.filter(r => !(
        r.pickupLat === pinCoords[0] &&
        r.pickupLng === pinCoords[1] &&
        r.departureTime === departureTime
      ))
      setSavedRides(updated)
      localStorage.setItem("savedRides", JSON.stringify(updated))
      showSaveNotification("")
      return
    }
    const newSaved = {
      id: Date.now(),
      pickupLat: pinCoords[0],
      pickupLng: pinCoords[1],
      pickupName: locationName,
      departureTime,
      departureTimeDisplay: formatTime(departureTime),
      savedAt: new Date().toISOString()
    }
    const updated = [newSaved, ...savedRides].slice(0, 5) // limit to 5
    setSavedRides(updated)
    localStorage.setItem("savedRides", JSON.stringify(updated))
    showSaveNotification("Ride saved!")
  }

  const deleteSavedRide = (id) => {
    const updated = savedRides.filter(r => r.id !== id)
    setSavedRides(updated)
    localStorage.setItem("savedRides", JSON.stringify(updated))
    toast("Saved ride removed.", { icon: "🗑️" })
  }

  // ── Account edit ──────────────────────────────────────────────────────────
  const [editEmail, setEditEmail] = useState("")
  const [editMode, setEditMode] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editMsg, setEditMsg] = useState("")

  const handleEditSave = async () => {
    if (!editEmail.trim()) return
    setEditLoading(true)
    setEditMsg("")
    try {
      await apiFetch("/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editEmail.trim().toLowerCase() }),
      })
      setProfile(prev => ({ ...prev, email: editEmail.trim().toLowerCase() }))
      setEditMsg("Email updated successfully!")
      setEditMode(false)
    } catch (err) {
      setEditMsg(err.message || "Failed to update email.")
    } finally {
      setEditLoading(false)
    }
  }

  const handlePicUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Please select an image file")
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be less than 5MB")

    setUploadingPic(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64Str = reader.result
      try {
        await apiFetch("/auth/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profilePic: base64Str })
        })
        setProfile(prev => ({ ...prev, profilePic: base64Str }))
        toast.success("Profile picture uploaded", {
          position: "bottom-center",
          icon: "✓",
          duration: 3000,
          style: {
            background: "#4B5563",
            color: "#fff",
            borderRadius: "10px",
            marginBottom: "6rem",
            fontSize: "14px"
          }
        })
      } catch (err) {
        toast.error("Failed to update profile picture", { position: "bottom-center" })
      } finally {
        setUploadingPic(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Map / ride state ──────────────────────────────────────────────────────
  const [liveGps, setLiveGps] = useState(null)
  const [pinCoords, setPinCoords] = useState(null)
  const [locationName, setLocationName] = useState("")
  const [gpsStatus, setGpsStatus] = useState("loading")
  const [departureTime, setDepartureTime] = useState("")
  const [timeError, setTimeError] = useState(false)
  const [locError, setLocError] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [loadingSugg, setLoadingSugg] = useState(false)
  const [showActiveRideWarning, setShowActiveRideWarning] = useState(false)
  const isUserTyping = useRef(false)
  const debTimer = useRef(null)
  const dropRef = useRef(null)
  const watchIdRef = useRef(null)

  const collegeCoords = [12.872109642876621, 74.84534749009204]
  const collegeName = "St Aloysius College, Mangalore"

  const applyPin = useCallback(async (lat, lng) => {
    setPinCoords([lat, lng])
    setLocationName("Getting address…")
    const name = await reverseGeocode(lat, lng)
    isUserTyping.current = false
    setLocationName(name)
    setLocError(false)
    setGpsStatus("ok")
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!navigator.geolocation) {
      setGpsStatus("error")
      setLocationName("GPS not supported — type your location")
      return
    }
    setGpsStatus("loading")
    setLocationName("Fetching your location…")

    const onFirstSuccess = (pos) => {
      if (cancelled) return
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setLiveGps([lat, lng])
      applyPin(lat, lng)
    }

    navigator.geolocation.getCurrentPosition(
      onFirstSuccess,
      () => {
        navigator.geolocation.getCurrentPosition(
          onFirstSuccess,
          () => { if (!cancelled) { setGpsStatus("error"); setLocationName("") } },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => { if (!cancelled) setLiveGps([pos.coords.latitude, pos.coords.longitude]) },
        () => { },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      )
    } catch { }

    return () => {
      cancelled = true
      try { navigator.geolocation.clearWatch(watchIdRef.current) } catch { }
    }
  }, [applyPin])

  useEffect(() => {
    if (!isUserTyping.current) return
    if (debTimer.current) clearTimeout(debTimer.current)
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

  const selectSuggestion = (item) => {
    isUserTyping.current = false
    setLocationName(item.short || item.label.split(",")[0])
    setPinCoords([item.lat, item.lng])
    setSuggestions([])
    setShowDrop(false)
    setLocError(false)
  }

  const useCurrentLocation = () => {
    // If we already have a live GPS fix from the background watcher, use it instantly.
    if (liveGps) {
      applyPin(liveGps[0], liveGps[1])
      setShowDrop(false)
      return
    }

    if (!navigator.geolocation) return
    setLocationName("Fetching your location…")
    setShowDrop(false)

    const onSuccess = (pos) => applyPin(pos.coords.latitude, pos.coords.longitude)
    const onError = () => { setGpsStatus("error"); setLocationName("") }

    // Use a shorter timeout and allow cached positions (maximumAge) for speed
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 10000
    })
  }

  const handleMapPick = async ([lat, lng]) => {
    setPinCoords([lat, lng])
    setLocationName("Getting address…")
    setShowDrop(false)
    const name = await reverseGeocode(lat, lng)
    isUserTyping.current = false
    setLocationName(name)
    setLocError(false)
  }

  const handleSearch = () => {
    let err = false
    if (!pinCoords) { setLocError(true); err = true } else setLocError(false)
    if (!departureTime) {
      setTimeError(true); err = true
    } else {
      const [h, m] = departureTime.split(":").map(Number)
      const sel = new Date(); sel.setHours(h, m, 0, 0)
      if (sel < new Date()) { setTimeError(true); err = true } else setTimeError(false)
    }
    if (!err) setShowPopup(true)
  }

  const handleConfirm = () => {
    // Auto-save so "Saved" button always reflects last ride
    if (pinCoords) {
      localStorage.setItem("savedRide", JSON.stringify({
        pickupLat: pinCoords[0],
        pickupLng: pinCoords[1],
        departureTime,
      }))
    }
    setShowPopup(false)
    navigate("/rider-searching", {
      state: {
        userLocation: pinCoords,
        liveGpsLocation: liveGps,
        collegeLocation: collegeCoords,
        departureTime: formatTime(departureTime),
        departureTimeRaw: departureTime,
        pickupAddress: locationName,
      },
    })
  }

  const mapCenter = pinCoords || liveGps

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">

      {/* ── SAVE NOTIFICATION ── */}
      {saveNotification && (
        <div className="fixed top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] bg-black/80 text-white px-5 py-2.5 rounded-full shadow-lg text-sm font-medium animate-fade-in-up">
          {saveNotification}
        </div>
      )}

      {/* ── TOP HEADER ── */}
      {tab === "home" && (
        <div className="flex items-center justify-between px-4 pt-5 pb-3 bg-white shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Welcome, <span className="text-teal-600">{firstName}</span>!
            </h1>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION POPUP ── */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">

            <h2 className="text-lg font-semibold text-center text-gray-900 mb-1">Confirm Ride Post</h2><br></br>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-teal-500">📍</span>
                <span className="text-gray-700 font-medium truncate">{locationName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-teal-500">🕐</span>
                <span className="text-gray-700 font-medium">{formatTime(departureTime)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPopup(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SWITCH CONFIRMATION POPUP ── */}
      <AnimatePresence>
        {showSwitchPassengerConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-[20px] p-6 w-full max-w-[320px] shadow-xl text-center"
            >
              <p className="text-black font-semibold text-[17px] tracking-tight mb-6 mt-2">Are you sure you want to switch to passenger ?</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setShowSwitchPassengerConfirm(false)} className="flex-1 py-3 rounded-xl bg-gray-200 text-black font-semibold transition hover:bg-black hover:text-white">
                  No
                </button>
                <button onClick={async () => {
                  if (hasActiveRide) {
                    setShowSwitchPassengerConfirm(false)
                    setShowActiveRideWarning(true)
                    return
                  }
                  setShowSwitchPassengerConfirm(false)
                  navigate("/dashboard")
                }} className="flex-1 py-3 rounded-xl bg-gray-200 text-black font-semibold transition hover:bg-black hover:text-white">
                  Yes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ── LOG OUT CONFIRMATION POPUP ── */}
      <AnimatePresence>
        {showSignOutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-[20px] p-6 w-full max-w-[320px] shadow-xl text-center"
            >
              <p className="text-black font-semibold text-[17px] tracking-tight mb-6 mt-2">
                Are you sure you want to log out?
              </p>

              <div className="flex gap-4 justify-center">

                {/* CANCEL */}
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-200 text-black font-semibold transition-all duration-200 hover:bg-black hover:text-white"
                >
                  Cancel
                </button>

                {/* LOG OUT */}
                <button
                  onClick={async () => {
                    if (hasActiveRide) return

                    setShowSignOutConfirm(false)
                    await handleLogout()
                  }}
                  disabled={hasActiveRide}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-200 ${hasActiveRide
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-200 text-black hover:bg-red-500 hover:text-white active:scale-[0.98]"
                    }`}
                >
                  Log Out
                </button>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showActiveRideWarning && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-[20px] p-6 w-full max-w-[320px] shadow-xl text-center"
            >
              <p className="text-black font-semibold text-[17px] mb-6">
                You cannot switch roles during an active ride.
              </p>

              <button
                onClick={() => setShowActiveRideWarning(false)}
                className="w-32 py-3 rounded-xl bg-red-500 text-white font-semibold"
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ══════════════════ HOME TAB ══════════════════ */}
      {tab === "home" && (
        <div className="px-4 pt-4 space-y-4">

          {/* MAP */}
          <div className="map-container rounded-3xl overflow-hidden shadow-sm relative">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[999] bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none flex items-center gap-1.5">
              <span>📍</span> Tap map to set pickup point
            </div>
            {mapCenter ? (
              <MapContainer center={mapCenter} zoom={15} style={{ height: "100%", width: "100%" }}
                dragging zoomControl={false} scrollWheelZoom doubleClickZoom>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; CARTO'
                  maxZoom={20}
                />
                {pinCoords && (
                  <Marker
                    position={pinCoords}
                    icon={L.divIcon({
                      className: 'custom-pin',
                      html: `<div style="background-color: black; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"><div style="width: 10px; height: 10px; background-color: white; border-radius: 50%; transform: rotate(45deg);"></div></div>`,
                      iconSize: [30, 30],
                      iconAnchor: [15, 30]
                    })}
                  />
                )}
                <RecenterMap position={pinCoords} />
                <MapClickHandler onPick={handleMapPick} />
              </MapContainer>

            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-100 text-gray-400 text-sm gap-2">
                <span className="text-3xl animate-bounce">📍</span>
                {gpsStatus === "loading" && <span>Fetching your location…</span>}
                {gpsStatus === "error" && <span>Tap "Use current location" or type below</span>}
              </div>
            )}
          </div>
          {/* POST RIDE CARD */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 px-5 py-5 space-y-3">

            <h2 className="text-base font-bold text-gray-900">Post a Ride</h2>

            {/* Route block — From / To stacked */}
            <div className="relative bg-gray-50 rounded-2xl border border-gray-100">

              {/* FROM */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-3 h-3 rounded-full border-2 border-teal-500 bg-white flex-shrink-0" />
                <div className="flex-1 relative" ref={dropRef}>
                  <input type="text" value={locationName}
                    onChange={(e) => { isUserTyping.current = true; setLocationName(e.target.value); setLocError(false) }}
                    onFocus={() => { if (suggestions.length > 0) setShowDrop(true) }}
                    placeholder="Your pickup location…"
                    className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                  />
                  {loadingSugg && <span className="absolute right-0 top-0 text-gray-400 animate-spin">⟳</span>}
                  {showDrop && suggestions.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <li key={`${s.lat}-${s.lng}-${i}`} className="border-b border-gray-100 last:border-0">
                          <button type="button" onMouseDown={() => selectSuggestion(s)}
                            className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition">
                            <span className="block font-medium text-sm text-gray-800">{s.short}</span>
                            <span className="block text-xs text-gray-400 truncate">{s.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={saveCurrentRide} title={isCurrentRideSaved() ? "Ride saved" : "Save this ride"}
                    className={`flex-shrink-0 transition ${isCurrentRideSaved() ? 'text-teal-600' : 'text-gray-400 hover:text-teal-600'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill={isCurrentRideSaved() ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  <button type="button" onClick={useCurrentLocation} title="Use current location"
                    className="text-teal-500 hover:text-teal-700 flex-shrink-0 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <circle cx="12" cy="12" r="3" /><path strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Divider with dashed line */}
              <div className="flex items-center gap-3 px-4">
                <div className="w-3 flex justify-center">
                  <div className="w-px h-4 border-l-2 border-dashed border-gray-100" />
                </div>
                <div className="flex-1 border-t border-dashed border-gray-100" />
              </div>

              {/* TO */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-3 h-3 rounded-sm bg-red-400 flex-shrink-0" />
                <p className="text-sm text-gray-500 font-medium flex-1">{collegeName}</p>
              </div>
            </div>

            {locError && <p className="text-red-500 text-xs">⚠ Could not determine your location.</p>}

            {/* Departure time */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3.5">
              <span className="text-gray-400">🕐</span>
              <input type="time" value={departureTime} min={getMinTime()}
                onChange={(e) => { setDepartureTime(e.target.value); setTimeError(false) }}
                className="flex-1 bg-transparent text-sm text-gray-800 focus:outline-none accent-gray-500"
                style={{ colorScheme: "light" }}
              />
            </div>
            {timeError && <p className="text-red-500 text-xs">⚠ Please select a valid future departure time.</p>}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={hasActiveRide ? () => toast.error("Complete your active ride first.") : handleSearch}
                disabled={hasActiveRide}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition active:scale-95 ${hasActiveRide
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-900 hover:bg-gray-700 text-white"
                  }`}>
                {hasActiveRide ? "Ride in Progress" : "Search for Passenger"}
              </button>
              <button
                onClick={() => {
                  const saved = JSON.parse(localStorage.getItem("savedRides") || "[]")
                  setSavedRides(Array.isArray(saved) ? saved : [])
                  setTab("saved")
                }}
                className="px-4 py-3 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition whitespace-nowrap"
                title="View saved rides"
              >
                Saved
              </button>
            </div>

          </div>


        </div>
      )}

      {/* ══════════════════ HISTORY TAB ══════════════════ */}
      {tab === "history" && (
        <div className="px-4 pt-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Ride History</h2>
          {historyLoad && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {historyErr && <div className="text-center py-16 text-red-500 text-sm">{historyErr}</div>}

          {!historyLoad && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-fade-in">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Clock className="w-10 h-10 text-gray-300" />
              </div>
              <p className="font-bold text-[15px] text-gray-400">No completed rides yet.</p>
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
                      <p className="text-sm font-medium text-gray-800">{ride.pickupAddress || ride.passenger?.pickupAddress || ride.locationName || "Location Saved"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Destination</p>
                      <p className="text-sm font-medium text-gray-800">{ride.destination || collegeName}</p>
                    </div>
                  </div>
                </div>
                {ride.fare != null && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Fare Earned</span>
                    <span className="text-sm font-bold text-teal-600">₹{typeof ride.fare === 'object' ? (ride.fare?.amount || 0) : (ride.fare || 0)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════ ACCOUNT TAB ══════════════════ */}
      {tab === "account" && (
        <div className="px-4 pt-5 pb-24">
          {accountView === "menu" && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile</h2>

              {profileLoad ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div onClick={() => setAccountView("details")} className="bg-white border border-gray-300 rounded-[20px] p-4 flex items-center justify-between shadow-sm cursor-pointer mb-6 active:scale-[0.98] transition">
                    <div className="flex items-center gap-4">

                      <div className="relative w-16 h-16 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input type="file" id="profileUpload" accept="image/*" className="hidden" onChange={handlePicUpload} disabled={uploadingPic} onClick={(e) => e.stopPropagation()} />
                        <label htmlFor="profileUpload" className="cursor-pointer w-full h-full rounded-full bg-teal-50 flex items-center justify-center text-teal-600 border-2 border-white shadow-sm font-bold text-xl overflow-hidden hover:opacity-80 transition relative">
                          {uploadingPic ? (
                            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                          ) : profile?.profilePic ? (
                            <img src={profile.profilePic} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            (fullName || firstName || "R")[0].toUpperCase()
                          )}
                          <div className="absolute bottom-0 inset-x-0 h-1/3 bg-black/40 flex items-center justify-center pointer-events-none">
                            <span className="text-white text-[9px] font-semibold">EDIT</span>
                          </div>
                        </label>
                      </div>

                      <div>
                        <h2 className="text-gray-900 font-bold text-[17px]">{fullName || firstName}</h2>
                        <p className="text-gray-500 text-sm mt-0.5">{profile?.phone || profile?.email || "—"}</p>
                      </div>
                    </div>
                    <span className="text-gray-400 text-2xl">›</span>
                  </div>

                  <div className="bg-white border border-gray-300 rounded-[20px] overflow-hidden flex flex-col mb-6 shadow-sm">
                    {[
                      { label: "Ride Statistics", onClick: () => setAccountView("statistics") },
                      { label: "Help", onClick: () => setAccountView("help") },
                      { label: "Switch to Passenger", onClick: () => setShowSwitchPassengerConfirm(true) },
                      { label: "Theme", onClick: () => toast.success("Theme feature coming later!") },
                      { label: "Log Out", onClick: () => setShowSignOutConfirm(true) }
                    ].map((item, i, arr) => (
                      <div key={item.label} onClick={item.onClick} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition ${i !== arr.length - 1 ? "border-b border-gray-300" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className={`${item.label === "Log Out" ? "text-red-400 font-medium" : "text-gray-800 font-medium"} text-[15px]`}>{item.label}</span>
                        </div>
                        <span className="text-gray-400 text-xl">›</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {accountView === "details" && (
            <div className="animate-fade-in">
              <button onClick={() => setAccountView("menu")} className="mb-6 text-teal-600 font-bold flex items-center gap-1 text-[15px]">
                <span className="text-xl leading-none -mt-0.5">‹</span> Back
              </button>
              <h2 className="text-2xl font-bold mb-6 text-gray-900">User Details</h2>

              <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-300 relative space-y-4">
                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">Name</span>
                  <span className="text-gray-900 font-semibold text-sm">{fullName || firstName}</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">University ID</span>
                  <span className="text-gray-900 font-semibold text-sm">{profile?.universityId || "—"}</span>
                </div>


                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">Email</span>
                  <span className="text-gray-900 font-semibold text-sm truncate max-w-[200px]">{profile?.email || "—"}</span>
                </div>


                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">Phone</span>
                  <span className="text-gray-900 font-semibold text-sm">{profile?.phone || storedUser?.phone || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">Gender</span>
                  <span className="text-gray-900 font-semibold text-sm">{profile?.gender || "—"}</span>
                </div>
                {profile?.vehicleNo && (
                  <div className="flex justify-between pb-1">
                    <span className="text-gray-500 font-medium text-sm">Vehicle No</span>
                    <span className="text-gray-900 font-semibold text-sm uppercase">{profile.vehicleNo}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {accountView === "statistics" && (
            <div className="animate-fade-in">
              <button onClick={() => setAccountView("menu")} className="mb-6 text-teal-600 font-bold flex items-center gap-1 text-[15px]">
                <span className="text-xl leading-none -mt-0.5">‹</span> Back
              </button>
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Ride Statistics</h2>

              <div className="flex gap-2 mb-6 bg-white p-1 rounded-xl shadow-sm border-b border-gray-300">
                {['7 Days', '30 Days', '1 Year'].map((filter) => (
                  <button key={filter} onClick={() => setStatFilter(filter)} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition ${statFilter === filter ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {filter}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border-b border-gray-300 rounded-[20px] p-5 shadow-sm flex flex-col items-center justify-center py-6">
                  <span className="text-gray-500 font-medium text-xs">Total Rides</span>
                  <span className="text-gray-900 font-extrabold text-2xl mt-1">{profile?.totalRides ?? "0"}</span>
                </div>
                <div className="bg-white border-b border-gray-300 rounded-[20px] p-5 shadow-sm flex flex-col items-center justify-center py-6">
                  <span className="text-gray-500 font-medium text-xs">Total Earnings</span>
                  <span className="text-gray-900 font-extrabold text-2xl mt-1">{profile?.totalEarnings !== undefined ? `₹${profile.totalEarnings}` : "0"}</span>
                </div>
                <div className="bg-white border-b border-gray-300 rounded-[20px] p-5 shadow-sm flex flex-col items-center justify-center py-6 col-span-2">
                  <span className="text-gray-500 font-medium text-xs">Rating</span>
                  <span className="text-gray-900 font-extrabold text-2xl mt-1">{profile?.rating ? `${profile.rating}` : "5.0"}</span>
                </div>
              </div>
            </div>
          )}

          {accountView === "help" && (
            <div className="animate-fade-in">
              <button onClick={() => setAccountView("menu")} className="mb-6 text-teal-600 font-bold flex items-center gap-1 text-[15px]">
                <span className="text-xl leading-none -mt-0.5">‹</span> Back
              </button>
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Help & Support</h2>

              <div className="space-y-4">
                <div className="bg-white border border-gray-300 rounded-[20px] p-4 shadow-sm cursor-pointer hover:border-teal-200 transition">
                  <p className="font-bold text-gray-900">FAQs</p>
                  <p className="text-sm text-gray-500 mt-1">Frequently asked questions</p>
                </div>
                <div className="bg-white border-b border-gray-300 rounded-[20px] p-4 shadow-sm cursor-pointer hover:border-teal-200 transition">
                  <p className="font-bold text-gray-900">Get Help</p>
                  <p className="text-sm text-gray-500 mt-1">Contact customer support</p>
                </div>
                <div onClick={() => navigate("/raise-ticket", { state: { from: "/rider-home", tab: "account", accountView: "help" } })} className="bg-teal-50 border border-teal-100 rounded-[20px] p-4 shadow-sm cursor-pointer hover:bg-teal-100 transition">
                  <p className="font-bold text-teal-700">Raise Ticket</p>
                  <p className="text-sm text-teal-600 mt-1">Direct to admin dashboard</p>
                </div>
                <div onClick={() => navigate("/my-tickets", { state: { from: "/rider-home", tab: "account", accountView: "help" } })} className="bg-white border border-gray-300 rounded-[20px] p-4 shadow-sm cursor-pointer hover:border-teal-200 transition">
                  <p className="font-bold text-gray-900">My Tickets</p>
                  <p className="text-sm text-gray-500 mt-1">View open and past tickets</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ SAVED TAB ════════════════════ */}
      {tab === "saved" && (
        <div className="px-4 pt-5 pb-24">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => setTab("home")} className="text-gray-400 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-gray-900">Saved Rides</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4 ml-9">Tap a ride to use its details instantly</p>

          {savedRides.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <span className="text-5xl mb-3">🔖</span>
              <p className="text-sm font-medium">No saved rides yet</p>

            </div>
          ) : (
            <div className="space-y-4">
              {savedRides.map((ride) => (
                <div key={ride.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-teal-200 transition-colors group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 cursor-pointer" onClick={() => loadSavedRide(ride)}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
                          <span className="text-base">🔖</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800">Favorite Route</p>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">From</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{ride.pickupName || "Unknown"}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">To</p>
                            <p className="text-sm font-semibold text-gray-800">College</p>
                          </div>
                        </div>
                        {ride.departureTimeDisplay && (
                          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                            <span className="text-gray-400 text-xs">🕐</span>
                            <p className="text-xs text-gray-600 font-medium">{ride.departureTimeDisplay}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSavedRide(ride.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      title="Delete bookmark"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <button
                    onClick={() => loadSavedRide(ride)}
                    className="w-full mt-3 py-2.5 rounded-xl bg-teal-50 text-teal-600 text-sm font-semibold hover:bg-teal-600 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <span></span> Use this ride
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <BottomNav navTab={tab} setNavTab={setTab} />
    </div>
  )
}

// ── Small reusable components ─────────────────────────────────────────────────

function BottomNav({ navTab, setNavTab }) {
  const tabs = [
    { id: "home", icon: Compass, label: "Explore" },
    { id: "history", icon: Clock, label: "History" },
    { id: "account", icon: User, label: "Profile" }
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-2 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
      {tabs.map((t) => {
        const active = navTab === t.id;
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => setNavTab(t.id)} className="flex flex-col items-center gap-1.5 flex-1 relative group">
            <Icon className={`w-6 h-6 transition-colors duration-300 ${active ? "text-teal-600" : "text-gray-400 group-hover:text-gray-600"}`} />
            <span className={`text-[10px] uppercase tracking-wider font-semibold transition-colors ${active ? "text-teal-600" : "text-gray-400 group-hover:text-gray-600"}`}>{t.label}</span>
            {active && <motion.div layoutId="nav-pill" className="absolute -bottom-2 w-1.5 h-1.5 bg-teal-500 rounded-full" />}
          </button>
        )
      })}
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
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
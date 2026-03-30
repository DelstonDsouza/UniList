import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import toast from "react-hot-toast"
import L from "leaflet"
import { signOut } from "firebase/auth"
import { auth } from "../../config/firebase"
import { motion, useAnimation, useMotionValue, AnimatePresence } from "framer-motion"
import { Search, MapPin, LocateFixed, Navigation, Compass, User, RefreshCw, LogOut, Clock, Star } from "lucide-react"
import { useRide } from "../../context/RideContext"
import { apiFetch } from "../../services/api"
import ActiveRidePanel from "./ActiveRidePanel"
import UpcomingRide from "./UpcomingRide"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const ST_ALOYSIUS = [12.8737, 74.8462];

const NOMINATIM = "https://nominatim.openstreetmap.org"
const NOM_HEADERS = { "Accept-Language": "en", "User-Agent": "RideMateApp/1.0" }

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371; const dLat = ((lat2 - lat1) * Math.PI) / 180; const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const extractShortName = (data) => {
  const a = data.address || {}; const road = a.road || ""; const area = a.neighbourhood || a.suburb || ""
  const city = a.city || a.town || a.village || a.county || ""
  if (road && area && city) return `${road}, ${area}, ${city}`
  if (road && city) return `${road}, ${city}`
  if (area && city) return `${area}, ${city}`
  if (city) return city
  return data.display_name?.split(",").slice(0, 3).join(",").trim() ?? "Selected Location"
}

const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: NOM_HEADERS })
    const data = await res.json()
    if (!data || !data.display_name) throw new Error("No data")
    return extractShortName(data)
  } catch { 
    return "Current Location" 
  }
}

const searchPlaces = async (query) => {
  try {
    const res = await fetch(`${NOMINATIM}/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=6`, { headers: NOM_HEADERS })
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map((x) => ({
      label: x.display_name, short: extractShortName(x), lat: parseFloat(x.lat), lng: parseFloat(x.lon),
    }))
  } catch { return [] }
}

function MapClickListener({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick([e.latlng.lat, e.latlng.lng])
    }
  })
  return null
}

function RecenterMap({ mapBounds }) {
  const map = useMap()
  useEffect(() => {
    if (!mapBounds || mapBounds.length === 0) return
    const bounds = L.latLngBounds(mapBounds.length === 1 ? [mapBounds[0], mapBounds[0]] : mapBounds)
    map.fitBounds(bounds, {
      maxZoom: 15,
      animate: true,
      duration: 1.2,
      paddingTopLeft: [20, 100],
      paddingBottomRight: [20, window.innerHeight * 0.45]
    })
  }, [mapBounds, map])
  return null
}

function Stars({ rating = 0 }) {
  const val = parseFloat(rating) || 0
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3 h-3 ${s <= Math.round(val) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
      ))}
      <span className="text-xs text-gray-500 ml-1 font-medium">{val > 0 ? val.toFixed(1) : "—"}</span>
    </span>
  )
}

function calcPickupTime(departureTimeStr, etaMinutes) {
  if (!departureTimeStr) return null
  const str = departureTimeStr.trim()
  const ampm = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  const h24 = str.match(/^(\d{1,2}):(\d{2})$/)
  let hours, minutes
  if (ampm) {
    hours = parseInt(ampm[1]); minutes = parseInt(ampm[2])
    const p = ampm[3].toUpperCase()
    if (p === "PM" && hours !== 12) hours += 12
    if (p === "AM" && hours === 12) hours = 0
  } else if (h24) {
    hours = parseInt(h24[1]); minutes = parseInt(h24[2])
  } else return null
  const total = hours * 60 + minutes + etaMinutes
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  const period = h >= 12 ? "PM" : "AM"
  const dh = h % 12 === 0 ? 12 : h % 12
  return `${dh}:${String(m).padStart(2, "0")} ${period}`
}

function useCountdown(departureTimeStr) {
  const [secsLeft, setSecsLeft] = useState(null)
  useEffect(() => {
    if (!departureTimeStr) return
    const parse = (str) => {
      const ampm = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      const h24 = str.trim().match(/^(\d{1,2}):(\d{2})$/)
      let h, m; if (ampm) { h = parseInt(ampm[1]); m = parseInt(ampm[2]); const p = ampm[3].toUpperCase(); if (p === "PM" && h !== 12) h += 12; if (p === "AM" && h === 12) h = 0 } else if (h24) { h = parseInt(h24[1]); m = parseInt(h24[2]) } else return null
      const d = new Date(); d.setHours(h, m, 0, 0); return d
    }
    const target = parse(departureTimeStr)
    if (!target) return
    const tick = () => setSecsLeft(Math.round((target - Date.now()) / 1000))
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [departureTimeStr])
  return secsLeft
}

// Minimal Ride Card for the list
function RiderCard({ ride, passengerLocation, onRequest, requesting, passengerProfile, onClick }) {
  const [confirming, setConfirming] = useState(false)
  const { hasActiveRide } = useRide()

  const riderLat = ride.currentLocation?.coordinates?.[1]
  const riderLng = ride.currentLocation?.coordinates?.[0]
  const dist = passengerLocation && riderLat && riderLng ? distKm(passengerLocation[0], passengerLocation[1], riderLat, riderLng) : null
  const etaMinutes = dist !== null ? Math.round((dist / 32) * 60) : null
  const pickupTime = etaMinutes !== null ? calcPickupTime(ride.departureTime, etaMinutes) : null
  const rating = ride.ratingCount > 0 ? (ride.ratingSum / ride.ratingCount).toFixed(1) : ride.rating || 0
  const secsLeft = useCountdown(ride.departureTime)
  let countdownLabel = ""; let boxBg = "bg-gray-900"
  if (secsLeft !== null) {
    const minsLeft = secsLeft / 60
    if (secsLeft <= 0) countdownLabel = "Now!"
    else if (minsLeft < 60) countdownLabel = `${Math.floor(minsLeft)}m ${String(secsLeft % 60).padStart(2, "0")}s`
    else countdownLabel = `${Math.floor(minsLeft / 60)}h ${Math.floor(minsLeft % 60)}m`
    if (secsLeft <= 0 || minsLeft < 5) boxBg = "bg-red-500"
    else if (minsLeft < 10) boxBg = "bg-amber-500"
  }

  const handleConfirm = () => {
    if (!passengerProfile) return toast.error("Profile not loaded")
    onRequest(ride._id, `${passengerProfile.firstName} ${passengerProfile.lastName}`.trim(), passengerProfile.phone || "")
  }

  return (
    <div onClick={onClick} className="w-full bg-white rounded-[20px] p-4 flex flex-col gap-4 border border-gray-300 shadow-sm relative overflow-hidden cursor-pointer hover:border-teal-200 transition-all">
      {/* Accent glow line at top */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-400 to-teal-500 opacity-90"></div>

      <div className="flex gap-3 items-start">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-xl flex-shrink-0 shadow-sm border border-teal-100">
          {(ride.riderName || "R")[0].toUpperCase()}
        </div>

        <div className="flex flex-col flex-1 min-w-0 pl-1">
          <p className="font-bold text-gray-900 text-lg truncate tracking-wide">{ride.riderName || "—"}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Stars rating={rating} />
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span className="text-xs text-gray-500 font-medium truncate">{ride.locationName || ride.pickupArea || "—"}</span>
          </div>

          <div className="flex gap-2 mt-2.5">
            {dist !== null && (
              <div className="flex items-center gap-1.5 bg-gray-50 rounded-md px-2 py-1 border border-gray-300">
                <Navigation className="w-3 h-3 text-teal-600" />
                <span className="text-[11px] font-semibold text-gray-700">{dist.toFixed(1)} km</span>
              </div>
            )}
            {pickupTime && (
              <div className="flex items-center gap-1.5 bg-gray-50 rounded-md px-2 py-1 border border-gray-300">
                <Clock className="w-3 h-3 text-emerald-600" />
                <span className="text-[11px] font-semibold text-gray-700">{pickupTime}</span>
              </div>
            )}
          </div>
        </div>

        {/* Start Countdown Box */}
        {secsLeft !== null && (
          <div className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-2 py-2 text-white ${boxBg} shadow-sm`} style={{ minWidth: 70 }}>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-90 mb-0.5">Starts In</span>
            <span className="text-[13px] font-extrabold leading-none">{countdownLabel}</span>
          </div>
        )}
      </div>

      {/* Accept / Confirm ride */}
      {!confirming ? (
        <button onClick={(e) => {
          e.stopPropagation()
          if (hasActiveRide) {
            toast.error("Complete your current ride before joining another.")
            return
          }
          setConfirming(true)
        }} disabled={requesting}
          className="w-full py-3.5 rounded-xl bg-gray-900 text-white text-[15px] font-bold tracking-wide active:scale-95 transition-transform disabled:opacity-50 mt-1 hover:bg-gray-800 shadow-md">
          Accept Ride
        </button>
      ) : (
        <div className="flex gap-2 mt-1">
          <button onClick={(e) => { e.stopPropagation(); setConfirming(false) }}
            className="flex-1 py-3.5 rounded-xl bg-gray-100 text-gray-600 border border-gray-300 text-sm font-semibold hover:bg-gray-200 transition">
            Cancel
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleConfirm() }} disabled={requesting || !passengerProfile}
            className="flex-1 py-3.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition shadow-md">
            {requesting ? "Requesting…" : "Confirm"}
          </button>
        </div>
      )}
    </div>
  )
}

function BottomNav({ navTab, setNavTab }) {
  const tabs = [
    { id: "home", icon: Compass, label: "Explore" },
    { id: "history", icon: Clock, label: "History" },
    { id: "account", icon: User, label: "Profile" }
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-300 flex justify-around py-2 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
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

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function PassengerDashboard() {
  const navigate = useNavigate()
  const { viewState, nearbyRiders, loadingRiders, userLocation, requestRide, requestingRideId, fetchRiders, resetToDiscovery, hasActiveRide, activeRide } = useRide()

  const [navTab, setNavTab] = useState("home")
  const [accountView, setAccountView] = useState("menu")
  const [statFilter, setStatFilter] = useState("7 Days")
  const [uploadingPic, setUploadingPic] = useState(false)
  const [passengerProfile, setPassengerProfile] = useState(null)
  const [passengerLocation, setPassengerLocation] = useState(null)
  const [locationName, setLocationName] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [loadingSugg, setLoadingSugg] = useState(false)
  const [routePath, setRoutePath] = useState([])
  const [mapCenter, setMapCenter] = useState(ST_ALOYSIUS) // default center Mangalore
  const [mapBounds, setMapBounds] = useState([ST_ALOYSIUS])

  // History state
  const [history, setHistory] = useState([])
  const [historyLoad, setHistoryLoad] = useState(false)

  // Rider state
  const [showSwitchRiderConfirm, setShowSwitchRiderConfirm] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch { }
    localStorage.clear()
    navigate("/login")
  }
  const isUserTyping = useRef(false)
  const debTimer = useRef(null)
  const dropRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    apiFetch("/auth/me").then(data => setPassengerProfile(data.user || data)).catch(() => { })
  }, [])

  // Setup GPS & route
  useEffect(() => {
    if (!userLocation || passengerLocation) return
    setPassengerLocation(userLocation)
    setMapCenter(userLocation)
    setMapBounds([userLocation])
    reverseGeocode(userLocation[0], userLocation[1]).then(setLocationName)
  }, [userLocation])

  useEffect(() => {
    if (!passengerLocation) return
    fetchRiders(passengerLocation)
    setMapCenter(passengerLocation)
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => fetchRiders(passengerLocation), 60000)

    // Fetch Route
    fetch(`https://router.project-osrm.org/route/v1/driving/${passengerLocation[1]},${passengerLocation[0]};${ST_ALOYSIUS[1]},${ST_ALOYSIUS[0]}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0]) {
          const arr = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          setRoutePath(arr);
          setMapBounds(arr);
        } else {
          setRoutePath([passengerLocation, ST_ALOYSIUS]);
          setMapBounds([passengerLocation, ST_ALOYSIUS]);
        }
      }).catch(() => {
        setRoutePath([passengerLocation, ST_ALOYSIUS]);
        setMapBounds([passengerLocation, ST_ALOYSIUS]);
      })

    return () => clearInterval(pollRef.current)
  }, [passengerLocation, fetchRiders])

  // Click outside suggestion drop
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false) }
    document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Auto-complete
  useEffect(() => {
    if (!isUserTyping.current) return
    clearTimeout(debTimer.current)
    const q = locationName.trim()
    if (q.length < 3) { setSuggestions([]); setShowDrop(false); setLoadingSugg(false); return }
    setLoadingSugg(true)
    debTimer.current = setTimeout(async () => {
      const items = await searchPlaces(q)
      setSuggestions(items); setShowDrop(items.length > 0); setLoadingSugg(false)
    }, 400)
    return () => clearTimeout(debTimer.current)
  }, [locationName])

  // Framer Motion Bottom Sheet logic
  const [dims, setDims] = useState({ vh: window.innerHeight })
  useEffect(() => {
    const fn = () => setDims({ vh: window.innerHeight })
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])

  // ── Prevent Back Navigation while in active ride ─
  useEffect(() => {
    if (!["confirmed", "pickup_started", "ongoing"].includes(viewState)) return;
    window.history.pushState(null, "", window.location.href)
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [viewState])

  const BOTTOM_NAV = 70;
  const SHEET_FULL = 100; // expanded leaves 100px from top
  const SHEET_HALF = dims.vh * 0.45;
  const SHEET_COLLAPSED = dims.vh - BOTTOM_NAV - 70; // peeks right above nav

  const sheetY = useMotionValue(SHEET_HALF)
  const sheetControls = useAnimation()

  useEffect(() => { sheetControls.start({ y: SHEET_HALF }) }, [SHEET_HALF, sheetControls])

  const handleDragEnd = (e, info) => {
    const velocity = info.velocity.y
    const currY = sheetY.get()
    const points = [SHEET_FULL, SHEET_HALF, SHEET_COLLAPSED]
    let closest = points[0]; let minDiff = Math.abs(currY - points[0])
    points.forEach(p => { const d = Math.abs(currY - p); if (d < minDiff) { minDiff = d; closest = p } })

    let target = closest;
    if (velocity < -120) { if (currY > SHEET_HALF + 50) target = SHEET_HALF; else target = SHEET_FULL }
    else if (velocity > 120) { if (currY < SHEET_HALF - 50) target = SHEET_HALF; else target = SHEET_COLLAPSED }

    sheetControls.start({ y: target, transition: { type: "spring", bounce: 0, duration: 0.4 } })
  }

  const selectSuggestion = (item) => {
    isUserTyping.current = false; setLocationName(item.short || item.label.split(",")[0]); setPassengerLocation([item.lat, item.lng]); setMapCenter([item.lat, item.lng]); setSuggestions([]); setShowDrop(false)
  }

  const onMapClick = async (loc) => {
    setPassengerLocation(loc)
    setMapCenter(loc)
    isUserTyping.current = false
    setLocationName("Fetching place name…")
    const name = await reverseGeocode(loc[0], loc[1])
    setLocationName(name)
  }

  const useCurrentLocation = () => {
    setShowDrop(false)
    if (!navigator.geolocation) return toast.error("GPS disabled")
    setLocationName("Fetching location…")
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const loc = [pos.coords.latitude, pos.coords.longitude]
      setPassengerLocation(loc); setMapCenter(loc); setMapBounds([loc])
      isUserTyping.current = false; setLocationName(await reverseGeocode(loc[0], loc[1]))
    }, () => toast.error("Failed to get GPS location"), { enableHighAccuracy: true })
  }

  const recenterToSelection = () => {
    if (routePath && routePath.length > 0) {
      setMapBounds([...routePath])
    } else if (passengerLocation) {
      setMapBounds([passengerLocation])
    } else if (userLocation && userLocation.length === 2) {
      setMapBounds([userLocation])
    }
  }

  useEffect(() => {
    if (navTab !== "history") return
    setHistoryLoad(true)
    const userId = passengerProfile?._id || JSON.parse(localStorage.getItem("user") || "{}").uid || ""
    apiFetch(`/rides/history?passengerId=${userId}`)
      .then(data => setHistory(Array.isArray(data.rides) ? data.rides : []))
      .catch(() => { })
      .finally(() => setHistoryLoad(false))
  }, [navTab, passengerProfile])

  const filtered = nearbyRiders.filter(r => {
    if (!r.departureTime) return true;
    const ampm = r.departureTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    const h24 = r.departureTime.trim().match(/^(\d{1,2}):(\d{2})$/)
    let h, m; if (ampm) { h = parseInt(ampm[1]); m = parseInt(ampm[2]); const p = ampm[3].toUpperCase(); if (p === "PM" && h !== 12) h += 12; if (p === "AM" && h === 12) h = 0 } else if (h24) { h = parseInt(h24[1]); m = parseInt(h24[2]) } else return true;
    const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime() > Date.now()
  })

  const handleRequest = useCallback(async (rideId, name, phone) => {
    try { await requestRide(rideId, name, phone, passengerLocation) }
    catch (err) { toast.error(err.message) }
  }, [requestRide, passengerLocation])



  const formatDate = (dateStr) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
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
        setPassengerProfile(prev => ({ ...prev, profilePic: base64Str }))
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

  if (viewState === "completed") { resetToDiscovery(); return null }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gray-50 relative text-gray-900 font-sans overflow-hidden">

      {/* ────────────────── SWITCH CONFIRMATION POPUP ────────────────── */}
      <AnimatePresence>
        {showSwitchRiderConfirm && (
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
              <p className="text-black font-bold text-[17px] tracking-tight mb-6 mt-2">you want to switch to rider ?</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setShowSwitchRiderConfirm(false)} className="flex-1 py-3 rounded-xl bg-gray-200 text-black font-semibold transition hover:bg-black hover:text-white">
                  No
                </button>
                <button onClick={() => {
                  if (hasActiveRide) {
                    setShowSwitchRiderConfirm(false)
                    toast.error("Complete your active ride before switching roles.")
                    return
                  }
                  setShowSwitchRiderConfirm(false)
                  navigate("/rider-home")
                }} className="flex-1 py-3 rounded-xl bg-gray-200 text-black font-semibold transition hover:bg-black hover:text-white">
                  Yes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ── SIGN OUT CONFIRMATION POPUP ── */}
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
                Are you sure you want to Log Out?
              </p>

              <div className="flex gap-4 justify-center">
                {/* NO */}
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-200 text-black font-semibold transition hover:bg-black hover:text-white"
                >
                  Cancel
                </button>

                {/* YES */}
                <button
                  onClick={async () => {
                    if (hasActiveRide) {
                      setShowSignOutConfirm(false)
                      toast.error("Complete your active ride before signing out.")
                      return
                    }
                    setShowSignOutConfirm(false)
                    await handleLogout()
                  }}
                  className="flex-1 py-3 rounded-xl bg-gray-200 text-black font-semibold transition hover:bg-red-500 hover:text-white active:scale-[0.98]"
                >
                  Log Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* ────────────────── MAP VIEW (HOME TAB ONLY) ────────────────── */}
      {navTab === "home" && !["confirmed", "pickup_started", "waiting", "ongoing", "fare_reveal"].includes(viewState) && (
        <>
          <div className="absolute inset-0 z-0 bg-gray-100">
            <MapContainer center={mapCenter} zoom={14} zoomControl={false} className="w-full h-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
              <RecenterMap mapBounds={mapBounds} />
              <MapClickListener onMapClick={onMapClick} />

              {passengerLocation && (
                <Marker position={passengerLocation} icon={L.divIcon({
                  className: 'custom-pin',
                  html: `<div style="background-color: #0f766e; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
                  iconSize: [22, 22], iconAnchor: [11, 11]
                })} />
              )}

              <Marker position={ST_ALOYSIUS} icon={L.divIcon({
                className: 'custom-pin-dest',
                html: `<div style="background-color: #ef4444; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.3);"><div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div></div>`,
                iconSize: [26, 26], iconAnchor: [13, 13]
              })} />

              {routePath.length > 0 && (
                <Polyline positions={routePath} pathOptions={{ color: "#0d9488", weight: 5, opacity: 0.8 }} />
              )}
            </MapContainer>
          </div>

          {/* Floating Search Overlay */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-white/90 via-white/40 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))] pointer-events-none">
            <div className="relative pointer-events-auto" ref={dropRef}>
              <div className="bg-white border border-gray-300 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex items-center px-4 py-3.5 gap-3">
                <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-teal-600"></div>
                </div>
                <input
                  type="text" value={locationName}
                  onChange={e => { isUserTyping.current = true; setLocationName(e.target.value) }}
                  onFocus={() => { setShowDrop(true) }}
                  placeholder="Enter pickup location..."
                  className="bg-transparent text-gray-900 placeholder-gray-400 flex-1 text-sm md:text-[15px] font-medium focus:outline-none"
                />
                {loadingSugg ? <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" /> : <Search className="w-4 h-4 text-gray-400" />}
              </div>

              {showDrop && (
                <ul className="absolute top-[110%] left-0 right-0 bg-white border border-gray-300 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden pointer-events-auto z-50">
                  <li className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer">
                    <button onClick={useCurrentLocation} className="w-full text-left px-4 py-3 flex items-center gap-3">
                      <LocateFixed className="w-4 h-4 text-teal-600" />
                      <span className="block text-[15px] text-teal-600 font-medium">Use current location</span>
                    </button>
                  </li>
                  {suggestions.map((s, i) => (
                    <li key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer">
                      <button onClick={() => selectSuggestion(s)} className="w-full text-left px-4 py-3">
                        <span className="block text-[15px] text-gray-900 font-medium">{s.short}</span>
                        <span className="block text-xs text-gray-500 truncate mt-0.5">{s.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <button onClick={recenterToSelection} className="absolute z-10 top-28 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center border border-gray-300 shadow-[0_8px_20px_rgba(0,0,0,0.1)] group hover:border-teal-200 transition pointer-events-auto">
            <LocateFixed className="w-5 h-5 text-teal-600 group-hover:scale-110 transition-transform" />
          </button>

          {/* Draggable Bottom Sheet */}
          <motion.div
            drag="y"
            dragConstraints={{ top: SHEET_FULL, bottom: SHEET_COLLAPSED }}
            dragElastic={0.15}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            style={{ y: sheetY, height: dims.vh }}
            className="absolute top-0 left-0 right-0 z-20 bg-white rounded-t-[32px] border-t border-gray-300 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] flex flex-col pt-3"
          >
            {/* Drag Handle Area */}
            <div className="w-full pb-3 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing shrink-0" style={{ touchAction: 'none' }}>
              <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>

            <div className="px-5 pb-3 shrink-0 flex items-center justify-between border-b mx-4 border-gray-300">
              <h2 className="text-xl font-bold text-gray-900">Available Rides</h2>
              <div className="bg-teal-50 px-3 py-1 rounded-full text-xs font-semibold border border-teal-100 text-teal-700 tracking-wider">
                {filtered.length} RIDES
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-48 space-y-4 touch-pan-y"
              onPointerDownCapture={e => e.stopPropagation()}>
              {loadingRiders && (
                <div className="flex flex-col gap-4">
                  {[1, 2].map(i => <div key={i} className="h-36 bg-gray-50 border border-gray-300 rounded-[20px] animate-pulse"></div>)}
                </div>
              )}
              {!loadingRiders && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 space-y-3">
                  <Compass className="w-12 h-12 opacity-40 text-gray-400" />
                  <p className="text-[15px] font-medium text-gray-500">No riders available on this route</p>
                  <button onClick={() => fetchRiders(passengerLocation)} className="mt-2 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-teal-600 text-sm font-semibold hover:bg-gray-100 transition flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
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
                  onClick={() => {
                    const riderLat = ride.currentLocation?.coordinates?.[1] || ride.pickupLat;
                    const riderLng = ride.currentLocation?.coordinates?.[0] || ride.pickupLng;
                    if (riderLat && riderLng) setMapBounds([[riderLat, riderLng]]);
                  }}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}

      {/* ────────────────── ACTIVE RIDE VIEW ────────────────── */}
      {navTab === "home" && ["confirmed", "pickup_started", "waiting", "ongoing", "fare_reveal"].includes(viewState) && (
        <>
          {viewState === "confirmed" ? <UpcomingRide /> : <ActiveRidePanel />}
        </>
      )}

      {/* ────────────────── HISTORY VIEW ────────────────── */}
      {navTab === "history" && (
        <div className="flex-1 overflow-y-auto px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-32 bg-gray-50">
          <h1 className="text-3xl font-bold mb-6 tracking-wide text-gray-900">Ride History</h1>
          {historyLoad && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!historyLoad && history.length === 0 && (
            <div className="flex flex-col items-center justify-center opacity-70 h-48 text-gray-400">
              <Clock className="w-12 h-12 mb-3" />
              <p className="font-medium text-[15px]">No completed rides yet.</p>
            </div>
          )}
          <div className="space-y-4">
            {history.map((ride, i) => (
              <div key={ride._id || i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">{formatDate(ride.createdAt || ride.date)}</p>
                    {ride.riderName && <p className="text-sm font-bold text-gray-900 mt-0.5">{ride.riderName}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Completed</span>
                    {ride.distanceKm != null && <span className="text-[10px] text-gray-400 font-medium">{ride.distanceKm} km</span>}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Pickup</p>
                      <p className="text-sm font-medium text-gray-800">{ride.pickupLocation || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Destination</p>
                      <p className="text-sm font-medium text-gray-800">{ride.destination || "St Aloysius College"}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Fare Paid</span>
                  <span className="text-base font-bold text-teal-600">₹{ride.fare || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────── ACCOUNT VIEW ────────────────── */}
      {navTab === "account" && (
        <div className="flex-1 overflow-y-auto px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-32 bg-gray-50">
          {accountView === "menu" && (
            <>
              <h1 className="text-3xl font-bold mb-6 tracking-wide text-gray-900">Profile</h1>

              <div onClick={() => setAccountView("details")} className="bg-white border border-gray-300 rounded-[20px] p-4 flex items-center justify-between shadow-sm cursor-pointer mb-6 active:scale-[0.98] transition">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input type="file" id="profileUpload" accept="image/*" className="hidden" onChange={handlePicUpload} disabled={uploadingPic} onClick={(e) => e.stopPropagation()} />
                    <label htmlFor="profileUpload" className="cursor-pointer w-full h-full rounded-full bg-teal-50 flex items-center justify-center text-teal-600 border-2 border-white shadow-sm font-bold text-xl overflow-hidden hover:opacity-80 transition relative">
                      {uploadingPic ? (
                        <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                      ) : passengerProfile?.profilePic ? (
                        <img src={passengerProfile.profilePic} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        (passengerProfile?.firstName || "U")[0].toUpperCase()
                      )}
                      {/* small camera icon indicator */}
                      <div className="absolute bottom-0 inset-x-0 h-1/3 bg-black/40 flex items-center justify-center pointer-events-none">
                        <span className="text-white text-[9px] font-semibold">EDIT</span>
                      </div>
                    </label>
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-bold text-[17px]">{passengerProfile?.firstName} {passengerProfile?.lastName}</h2>
                    <p className="text-gray-500 text-sm mt-0.5">{passengerProfile?.phone || passengerProfile?.email || "—"}</p>
                  </div>
                </div>
                <span className="text-gray-400 text-2xl">›</span>
              </div>

              <div className="bg-white border border-gray-300 rounded-[20px] overflow-hidden flex flex-col mb-6 shadow-sm">
                {[
                  { label: "Ride Statistics", onClick: () => setAccountView("statistics") },
                  { label: "Help", onClick: () => setAccountView("help") },
                  passengerProfile?.isRider
                    ? {
                      label: "Switch to Rider",
                      onClick: () => setShowSwitchRiderConfirm(true)
                    }
                    : {
                      label: "Become a Rider",
                      onClick: () => {
                        if (hasActiveRide) {
                          toast.error("Complete your active ride before changing roles.")
                          return
                        }
                        navigate("/become-rider")
                      }
                    },
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

          {accountView === "details" && (
            <div className="animate-fade-in">
              <button onClick={() => setAccountView("menu")} className="mb-6 text-teal-600 font-bold flex items-center gap-1 text-[15px]">
                <span className="text-xl leading-none -mt-0.5">‹</span> Back
              </button>
              <h1 className="text-2xl font-bold mb-6 text-gray-900">User Details</h1>
              <div className="bg-white border border-gray-300 rounded-[24px] p-5 shadow-sm space-y-4">
                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">Name</span>
                  <span className="text-gray-900 font-bold text-sm">{passengerProfile?.firstName} {passengerProfile?.lastName}</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">University ID</span>
                  <span className="text-gray-900 font-bold text-sm">{passengerProfile?.universityId || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">Email</span>
                  <span className="text-gray-900 font-bold text-sm">{passengerProfile?.email || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-3">
                  <span className="text-gray-500 font-medium text-sm">Phone</span>
                  <span className="text-gray-900 font-bold text-sm">{passengerProfile?.phone || "—"}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-gray-500 font-medium text-sm">Gender</span>
                  <span className="text-gray-900 font-bold text-sm">{passengerProfile?.gender || "—"}</span>
                </div>
              </div>
            </div>
          )}

          {accountView === "statistics" && (
            <div className="animate-fade-in">
              <button onClick={() => setAccountView("menu")} className="mb-6 text-teal-600 font-bold flex items-center gap-1 text-[15px]">
                <span className="text-xl leading-none -mt-0.5">‹</span> Back
              </button>
              <h1 className="text-2xl font-bold mb-6 text-gray-900">Ride Statistics</h1>

              <div className="flex gap-2 mb-6 bg-white p-1 rounded-xl shadow-sm border border-gray-300">
                {['7 Days', '30 Days', '1 Year'].map((filter) => (
                  <button key={filter} onClick={() => setStatFilter(filter)} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition ${statFilter === filter ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {filter}
                  </button>
                ))}
              </div>

              <div className="bg-white border border-gray-300 rounded-[24px] p-6 shadow-sm flex flex-col items-center justify-center py-10">
                <span className="text-gray-400 font-medium text-sm">Total Rides Taken</span>
                <span className="text-gray-900 font-extrabold text-3xl mt-1">{passengerProfile?.totalRides ?? "0"}</span>
              </div>
            </div>
          )}

          {accountView === "help" && (
            <div className="animate-fade-in">
              <button onClick={() => setAccountView("menu")} className="mb-6 text-teal-600 font-bold flex items-center gap-1 text-[15px]">
                <span className="text-xl leading-none -mt-0.5">‹</span> Back
              </button>
              <h1 className="text-2xl font-bold mb-6 text-gray-900">Help & Support</h1>

              <div className="space-y-4">
                <div className="bg-white border border-gray-300 rounded-[20px] p-4 shadow-sm cursor-pointer hover:border-teal-200 transition">
                  <p className="font-bold text-gray-900">FAQs</p>
                  <p className="text-sm text-gray-500 mt-1">Frequently asked questions</p>
                </div>
                <div className="bg-white border border-gray-300 rounded-[20px] p-4 shadow-sm cursor-pointer hover:border-teal-200 transition">
                  <p className="font-bold text-gray-900">Get Help</p>
                  <p className="text-sm text-gray-500 mt-1">Contact customer support</p>
                </div>
                <div onClick={() => toast.success("Ticket raised to admin dashboard successfully!")} className="bg-teal-50 border border-teal-100 rounded-[20px] p-4 shadow-sm cursor-pointer hover:bg-teal-100 transition">
                  <p className="font-bold text-teal-700">Raise Ticket</p>
                  <p className="text-sm text-teal-600 mt-1">Direct to admin dashboard</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



      <BottomNav navTab={navTab} setNavTab={setNavTab} />
    </div>
  )
}
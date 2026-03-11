// src/pages/rider/RiderHome.jsx

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { signOut } from "firebase/auth"
import { auth } from "../../config/firebase"
import { apiFetch } from "../../services/api"
import toast from "react-hot-toast"

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

// ── Avatar initials ──────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "R"
  const sz = size === "lg" ? "w-16 h-16 text-xl" : "w-9 h-9 text-sm"
  return (
    <div className={`${sz} rounded-full bg-teal-600 flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
export default function RiderHome() {
  const navigate = useNavigate()
  const [tab, setTab] = useState("home")

  // ── User info ─────────────────────────────────────────────────────────────
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}")
  const [profile, setProfile] = useState(null)
  const [profileLoad, setProfileLoad] = useState(true)

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
      .then(data => setHistory(Array.isArray(data.rides) ? data.rides : []))
      .catch(() => setHistoryErr("Could not load ride history."))
      .finally(() => setHistoryLoad(false))
  }, [tab, profile])

  // ── Saved rides ───────────────────────────────────────────────────────────
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
    toast.success(`Loaded saved ride from ${saved.pickupName || "saved location"}`)
  }

  const saveCurrentRide = () => {
    if (!pinCoords) {
      toast.error("Please select a pickup location first")
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
    toast.success("Ride saved to your bookmarks!")
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
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ── TOP HEADER ── */}
      {tab === "home" && (
        <div className="flex items-center justify-between px-4 pt-5 pb-3 bg-white shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Welcome, <span className="text-teal-600">{firstName}</span>!
            </h1>
          </div>
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setShowDropdown(v => !v)} className="focus:outline-none">
              <Avatar name={fullName || firstName} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <button onClick={() => { setShowDropdown(false); setTab("account") }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition">
                  <span>👤</span> View Profile
                </button>
                <div className="border-t border-gray-100" />
                <button onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 transition">
                  <span></span> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIRMATION POPUP ── */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">

            <h2 className="text-lg font-bold text-center text-gray-900 mb-1">Confirm Ride Post</h2>
            <p className="text-sm text-center text-gray-400 mb-4">Ready to find passengers?</p>
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
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
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
                  url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
                  attribution="&copy; OpenStreetMap contributors"
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
                    <ul className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
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
                  <button type="button" onClick={saveCurrentRide} title="Save this ride"
                    className="text-gray-400 hover:text-teal-600 flex-shrink-0 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  <div className="w-px h-4 border-l-2 border-dashed border-gray-300" />
                </div>
                <div className="flex-1 border-t border-dashed border-gray-200" />
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
                className="flex-1 bg-transparent text-sm text-gray-800 focus:outline-none"
              />
            </div>
            {timeError && <p className="text-red-500 text-xs">⚠ Please select a valid future departure time.</p>}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={handleSearch}
                className="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-gray-700 active:scale-95 text-white text-sm font-semibold transition">
                Search for Passenger
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
          {!historyLoad && !historyErr && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <span className="text-5xl mb-3">🚗</span>
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
                      <p className="text-sm font-medium text-gray-800">{ride.destination || collegeName}</p>
                    </div>
                  </div>
                </div>
                {ride.fare != null && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Fare Earned</span>
                    <span className="text-sm font-bold text-teal-600">₹{ride.fare}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════ ACCOUNT TAB ══════════════════ */}
      {tab === "account" && (
        <div className="px-4 pt-5 pb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Account</h2>
          {profileLoad ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative">
                {!editMode ? (
                  <button
                    onClick={() => { setEditMode(true); setEditEmail(profile?.email || "") }}
                    className="absolute top-4 right-4 p-2 text-teal-600 hover:bg-teal-50 rounded-full transition"
                    title="Edit Email"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                ) : (
                  <div className="absolute top-4 right-4 flex gap-1">
                    <button onClick={handleEditSave} disabled={editLoading} className="p-2 text-green-600 hover:bg-green-50 rounded-full transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button onClick={() => { setEditMode(false); setEditMsg("") }} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-4 mb-4">
                  <Avatar name={fullName || firstName} size="lg" />
                  <div>
                    <p className="font-bold text-gray-900 text-base">{fullName || firstName}</p>
                    <p className="text-xs text-teal-600 font-medium mt-0.5">Rider</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <InfoRow icon="🎓" label="University ID" value={profile?.universityId || "—"} />
                  {editMode ? (
                    <div className="flex items-center gap-3">
                      <span className="text-base w-5 text-center">📧</span>
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Email (Editable)</p>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          className="w-full bg-gray-50 border-b border-teal-200 py-1 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                          autoFocus
                          placeholder="your@email.com"
                        />
                        {editMsg && <p className={`text-[10px] mt-1 ${editMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>{editMsg}</p>}
                      </div>
                    </div>
                  ) : (
                    <InfoRow icon="📧" label="Email" value={profile?.email || "—"} />
                  )}
                  <InfoRow icon="📱" label="Phone" value={profile?.phone || storedUser?.phone || "—"} />
                  <InfoRow icon="⚥" label="Gender" value={profile?.gender || "—"} />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-gray-700 mb-3">Ride Statistics</p>
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Total Rides" value={profile?.totalRides ?? "—"} />
                  <StatBox label="Total Earnings" value={profile?.totalEarnings !== undefined ? `₹${profile.totalEarnings}` : "—"} />
                  <StatBox label="Rating" value={profile?.rating ? `${profile.rating} ⭐` : "—"} />
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <button onClick={handleLogout}
                  className="px-8 py-2.5 rounded-xl bg-red-50 border border-red-400 text-red-600 font-semibold text-sm hover:bg-red-100 transition inline-flex items-center gap-2">
                  <span></span> Logout
                </button>
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
                    <span>⚡</span> Use this ride
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-3 z-40 shadow-lg">
        <NavTab icon="🏠" label="Home" active={tab === "home"} onClick={() => setTab("home")} />
        <NavTab icon="📋" label="History" active={tab === "history"} onClick={() => setTab("history")} />
        <NavTab icon="👤" label="Account" active={tab === "account"} onClick={() => setTab("account")} />
      </div>
    </div>
  )
}

// ── Small reusable components ─────────────────────────────────────────────────

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
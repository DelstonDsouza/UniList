// src/pages/rider/RiderHome.jsx

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"

import homeIcon from "../../assets/icons/home-icon.svg"
import exploreIcon from "../../assets/icons/explore-icon.svg"
import profileIcon from "../../assets/icons/profile-icon.svg"

// ─── Fix Leaflet marker icons broken by Vite ──────────────────────────────────
import L from "leaflet"
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ─── Sub-components (must live outside RiderHome) ─────────────────────────────

// Flies map to new position whenever `position` changes
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

// Lets user tap the map to pick a custom location
function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

// ─── Nominatim helpers (direct API calls — no proxy needed) ───────────────────
const NOMINATIM = "https://nominatim.openstreetmap.org"
const NOM_HEADERS = { "Accept-Language": "en", "User-Agent": "RideMateApp/1.0" }

const extractShortName = (data) => {
  const a = data.address || {}
  const road   = a.road || ""
  const area   = a.neighbourhood || a.suburb || ""
  const city   = a.city || a.town || a.village || a.county || ""
  if (road && area && city) return `${road}, ${area}, ${city}`
  if (road && city)         return `${road}, ${city}`
  if (area && city)         return `${area}, ${city}`
  if (city)                 return city
  return data.display_name?.split(",").slice(0, 3).join(",").trim() ?? "Current Location"
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

// ─── Time helpers ─────────────────────────────────────────────────────────────
const formatTime = (t) => {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}
const getMinTime = () => {
  const n = new Date()
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`
}

// ─── RiderHome ────────────────────────────────────────────────────────────────
export default function RiderHome() {
  const navigate = useNavigate()

  const [coords,        setCoords]        = useState(null)          // [lat, lng]
  const [locationName,  setLocationName]  = useState("")            // text box value
  const [gpsStatus,     setGpsStatus]     = useState("loading")     // loading | ok | error
  const [departureTime, setDepartureTime] = useState("")
  const [timeError,     setTimeError]     = useState(false)
  const [locError,      setLocError]      = useState(false)
  const [showPopup,     setShowPopup]     = useState(false)

  // autocomplete
  const [suggestions,     setSuggestions]     = useState([])
  const [showDrop,        setShowDrop]        = useState(false)
  const [loadingSugg,     setLoadingSugg]     = useState(false)

  const isUserTyping = useRef(false)
  const debTimer     = useRef(null)
  const dropRef      = useRef(null)
  const watchIdRef   = useRef(null)

  const collegeCoords = [12.872109642876621, 74.84534749009204]
  const collegeName   = "St Aloysius College, Mangalore"

  // ─── Apply GPS coordinates → set map + reverse geocode ──────────────────
  const applyCoords = useCallback(async (lat, lng, silent = false) => {
    setCoords([lat, lng])
    if (!silent) setLocationName("Getting address…")
    const name = await reverseGeocode(lat, lng)
    isUserTyping.current = false
    setLocationName(name)
    setLocError(false)
    setGpsStatus("ok")
  }, [])

  // ─── Auto-fetch GPS on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    if (!navigator.geolocation) {
      setGpsStatus("error")
      setLocationName("GPS not supported — type your location")
      return
    }

    setGpsStatus("loading")
    setLocationName("Fetching your location…")

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        applyCoords(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        if (cancelled) return
        // Don't alert — just show inline message
        console.warn("GPS error:", err.message)
        setGpsStatus("error")
        setLocationName("") // let user type manually
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )

    // Continuous watch — silently updates pin if user moves
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled || isUserTyping.current) return
          // Silent update — don't reset text if user is editing
          setCoords([pos.coords.latitude, pos.coords.longitude])
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      )
    } catch {}

    return () => {
      cancelled = true
      try { navigator.geolocation.clearWatch(watchIdRef.current) } catch {}
    }
  }, [applyCoords])

  // ─── Autocomplete while user types ──────────────────────────────────────
  useEffect(() => {
    if (!isUserTyping.current) return
    if (debTimer.current) clearTimeout(debTimer.current)

    const q = locationName.trim()
    if (q.length < 3) {
      setSuggestions([])
      setShowDrop(false)
      setLoadingSugg(false)
      return
    }

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

  // ─── Handlers ────────────────────────────────────────────────────────────

  const selectSuggestion = (item) => {
    isUserTyping.current = false
    setLocationName(item.short || item.label.split(",")[0])
    setCoords([item.lat, item.lng])
    setSuggestions([])
    setShowDrop(false)
    setLocError(false)
  }

  // "Use current location" link
  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocationName("Fetching your location…")
    setShowDrop(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => applyCoords(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        console.warn("GPS denied:", err.message)
        setGpsStatus("error")
        setLocationName("")
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // Map tap to pick location
  const handleMapPick = async ([lat, lng]) => {
    setCoords([lat, lng])
    setLocationName("Getting address…")
    setShowDrop(false)
    const name = await reverseGeocode(lat, lng)
    isUserTyping.current = false
    setLocationName(name)
    setLocError(false)
  }

  const handleSearch = () => {
    let err = false
    if (!coords)       { setLocError(true);  err = true } else setLocError(false)
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
    setShowPopup(false)
    navigate("/rider-searching", {
      state: {
        userLocation:      coords,
        collegeLocation:   collegeCoords,
        departureTime:     formatTime(departureTime),
        departureTimeRaw:  departureTime,   // HH:mm (24h) used for real-time matching
      },
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button className="text-2xl leading-none">☰</button>
        <h1 className="text-lg font-semibold">Welcome, Rider !</h1>
        <div className="w-9 h-9 bg-teal-400 rounded-full" />
      </div>

      {/* MAP */}
      <div className="mt-4 mx-4 rounded-3xl overflow-hidden shadow-sm" style={{ height: 220 }}>
        {coords ? (
          <MapContainer center={coords} zoom={15} style={{ height: "100%", width: "100%" }}
            dragging zoomControl scrollWheelZoom doubleClickZoom>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            <Marker position={coords} />
            <RecenterMap position={coords} />
            <MapClickHandler onPick={handleMapPick} />
          </MapContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-slate-100 text-gray-400 text-sm gap-2">
            <span className="text-3xl animate-bounce">📍</span>
            {gpsStatus === "loading" && <span>Fetching your location…</span>}
            {gpsStatus === "error"   && <span>Tap "Use current location" or type below</span>}
          </div>
        )}
      </div>

      {/* CONFIRMATION POPUP */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Confirm Ride Post</h2>
            <p className="text-sm text-gray-500 mb-1">From: <strong>{locationName}</strong></p>
            <p className="text-sm text-gray-500 mb-4">Departure: <strong>{formatTime(departureTime)}</strong></p>
            <div className="flex gap-3">
              <button onClick={() => setShowPopup(false)}
                className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleConfirm}
                className="flex-1 py-2 rounded-xl bg-teal-500 text-white font-medium hover:bg-teal-600 transition">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST RIDE CARD */}
      <div className="px-4 mt-5">
        <h2 className="font-semibold mb-3">Post a Ride</h2>

        <div className="p-5 rounded-2xl space-y-4 text-white" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>

          {/* Current Location */}
          <div>
            <label className="text-sm opacity-80 block mb-1">Current Location</label>
            <div className="relative" ref={dropRef}>
              <input
                type="text"
                value={locationName}
                onChange={(e) => {
                  isUserTyping.current = true
                  setLocationName(e.target.value)
                  setLocError(false)
                }}
                onFocus={() => { if (suggestions.length > 0) setShowDrop(true) }}
                placeholder="Type an address…"
                className={`w-full p-3 rounded-lg text-black bg-white text-sm border
                  ${locError ? "border-red-500 ring-1 ring-red-400" : "border-transparent"}
                  focus:outline-none focus:ring-2 focus:ring-teal-400 transition`}
              />

              {/* Loading spinner inside input */}
              {loadingSugg && (
                <span className="absolute right-3 top-3.5 text-gray-400 text-base animate-spin select-none">⟳</span>
              )}

              {/* Suggestions dropdown */}
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

            {/* GPS link */}
            <button type="button" onClick={useCurrentLocation}
              className="mt-2 text-xs text-teal-400 hover:text-teal-200 hover:underline transition">
              📍 Use current location
            </button>

            {locError && <p className="text-red-400 text-xs mt-1">⚠ Could not determine your location.</p>}
          </div>

          {/* Destination */}
          <div>
            <label className="text-sm opacity-80 block mb-1">Destination</label>
            <input value={collegeName} readOnly
              className="w-full p-3 rounded-lg text-black bg-white text-sm cursor-default" />
          </div>

          {/* Departure Time */}
          <div>
            <label className="text-sm opacity-80 block mb-1">Departure Time</label>
            <input type="time" value={departureTime} min={getMinTime()}
              onChange={(e) => { setDepartureTime(e.target.value); setTimeError(false) }}
              className={`w-full p-3 rounded-lg text-black bg-white text-sm border
                ${timeError ? "border-red-500 ring-1 ring-red-400" : "border-transparent"}
                focus:outline-none focus:ring-2 focus:ring-teal-400 transition`}
            />
            {timeError && <p className="text-red-400 text-xs mt-1">⚠ Please select a valid future departure time.</p>}
          </div>

          <button onClick={handleSearch}
            className="w-full mt-2 bg-gray-200 hover:bg-gray-300 active:scale-95 text-black font-medium py-3 rounded-xl transition">
            Search for Passenger
          </button>

          <button className="mt-2 bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded-lg text-sm transition">
            Saved Rides
          </button>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 z-40">
        <div className="text-center">
          <img src={homeIcon} className="w-6 mx-auto mb-1" alt="Home" />
          <div className="text-sm font-medium">Home</div>
        </div>
        <div className="text-center text-gray-400">
          <img src={exploreIcon} className="w-6 mx-auto mb-1 opacity-60" alt="History" />
          <div className="text-sm">History</div>
        </div>
        <div className="text-center text-gray-400">
          <img src={profileIcon} className="w-6 mx-auto mb-1 opacity-60" alt="Account" />
          <div className="text-sm">Account</div>
        </div>
      </div>

    </div>
  )
}
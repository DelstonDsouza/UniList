// src/pages/rider/RiderHome.jsx

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"

import homeIcon from "../../assets/icons/home-icon.svg"
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
    map.flyTo(position, 16, { animate: true, duration: 1.0 })
  }, [position, map])
  return null
}

function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

const NOMINATIM  = "/nominatim"
const NOM_HEADERS = { "Accept-Language": "en", "User-Agent": "RideMateApp/1.0" }

const extractShortName = (data) => {
  const a    = data.address || {}
  const road = a.road || ""
  const area = a.neighbourhood || a.suburb || ""
  const city = a.city || a.town || a.village || a.county || ""
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

const formatTime = (t) => {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}
const getMinTime = () => {
  const n = new Date()
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`
}

export default function RiderHome() {
  const navigate = useNavigate()

  // ── TWO separate location states ──────────────────────────────────────────
  // liveGps   → rider's real GPS position (used only for map centering on mount)
  // pinCoords → the pickup location the rider chose (map pin / search / GPS button)
  //             THIS is what gets submitted. GPS watch never overwrites this.
  const [liveGps,       setLiveGps]       = useState(null)
  const [pinCoords,     setPinCoords]     = useState(null)  // ← submitted pickup point
  const [locationName,  setLocationName]  = useState("")
  const [gpsStatus,     setGpsStatus]     = useState("loading")
  const [departureTime, setDepartureTime] = useState("")
  const [timeError,     setTimeError]     = useState(false)
  const [locError,      setLocError]      = useState(false)
  const [showPopup,     setShowPopup]     = useState(false)

  const [suggestions, setSuggestions] = useState([])
  const [showDrop,    setShowDrop]    = useState(false)
  const [loadingSugg, setLoadingSugg] = useState(false)

  const isUserTyping = useRef(false)
  const debTimer     = useRef(null)
  const dropRef      = useRef(null)
  const watchIdRef   = useRef(null)

  const collegeCoords = [12.872109642876621, 74.84534749009204]
  const collegeName   = "St Aloysius College, Mangalore"

  // ── Set both pin and label (used when GPS or button sets location) ─────────
  const applyPin = useCallback(async (lat, lng) => {
    setPinCoords([lat, lng])
    setLocationName("Getting address…")
    const name = await reverseGeocode(lat, lng)
    isUserTyping.current = false
    setLocationName(name)
    setLocError(false)
    setGpsStatus("ok")
  }, [])

  // ── GPS on mount — sets liveGps for map center + sets initial pin ──────────
  useEffect(() => {
    let cancelled = false
    if (!navigator.geolocation) {
      setGpsStatus("error")
      setLocationName("GPS not supported — type your location")
      return
    }
    setGpsStatus("loading")
    setLocationName("Fetching your location…")

    const onSuccess = (pos) => {
      if (cancelled) return
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setLiveGps([lat, lng])
      // Only set pin on first GPS fix — never overwrite a user-chosen pin
      setPinCoords(prev => prev ?? [lat, lng])
      if (!prev) applyPin(lat, lng)
    }

    // Simplified: just call applyPin once on first success
    const onFirstSuccess = (pos) => {
      if (cancelled) return
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setLiveGps([lat, lng])
      applyPin(lat, lng)  // sets pinCoords + label on first load only
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

    // Continuous watch — ONLY updates liveGps for map dot, NEVER touches pinCoords
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return
          setLiveGps([pos.coords.latitude, pos.coords.longitude])
          // ← intentionally NOT calling applyPin here
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      )
    } catch {}

    return () => {
      cancelled = true
      try { navigator.geolocation.clearWatch(watchIdRef.current) } catch {}
    }
  }, [applyPin])

  // ── Autocomplete ──────────────────────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const selectSuggestion = (item) => {
    isUserTyping.current = false
    setLocationName(item.short || item.label.split(",")[0])
    setPinCoords([item.lat, item.lng])  // ← sets pin only, not liveGps
    setSuggestions([])
    setShowDrop(false)
    setLocError(false)
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocationName("Fetching your location…")
    setShowDrop(false)
    const onSuccess = (pos) => applyPin(pos.coords.latitude, pos.coords.longitude)
    const onError   = () => { setGpsStatus("error"); setLocationName("") }
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      () => navigator.geolocation.getCurrentPosition(onSuccess, onError,
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // Map pin click — sets pinCoords + label, DOES NOT touch liveGps
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
    setShowPopup(false)
    navigate("/rider-searching", {
      state: {
        userLocation:     pinCoords,       // ← pinned location, not live GPS
        liveGpsLocation:  liveGps,         // ← actual GPS (for rider's current position)
        collegeLocation:  collegeCoords,
        departureTime:    formatTime(departureTime),
        departureTimeRaw: departureTime,
      },
    })
  }

  // Map shows pin marker (pinCoords) and centers on it initially
  const mapCenter = pinCoords || liveGps

  return (
    <div className="min-h-screen bg-gray-100 pb-24">

      <div className="flex items-center justify-between px-4 pt-4">
        <button className="text-2xl leading-none">☰</button>
        <h1 className="text-lg font-semibold">Welcome, Rider !</h1>
        <div className="w-9 h-9 bg-teal-400 rounded-full" />
      </div>

      {/* MAP */}
      <div className="mt-4 mx-4 rounded-3xl overflow-hidden shadow-sm relative" style={{ height: 220 }}>
        {/* Hint overlay */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[999] bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
          📍 Tap map to set pickup point
        </div>
        {mapCenter ? (
          <MapContainer center={mapCenter} zoom={15} style={{ height: "100%", width: "100%" }}
            dragging zoomControl scrollWheelZoom doubleClickZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>' />
            {/* Pinned pickup marker */}
            {pinCoords && <Marker position={pinCoords} />}
            {/* Center map on pin (only moves when pin changes, not on GPS watch) */}
            <RecenterMap position={pinCoords} />
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

          <div>
            <label className="text-sm opacity-80 block mb-1">Current Location</label>
            <div className="relative" ref={dropRef}>
              <input type="text" value={locationName}
                onChange={(e) => {
                  isUserTyping.current = true
                  setLocationName(e.target.value)
                  setLocError(false)
                }}
                onFocus={() => { if (suggestions.length > 0) setShowDrop(true) }}
                placeholder="Type an address or tap the map…"
                className={`w-full p-3 rounded-lg text-black bg-white text-sm border
                  ${locError ? "border-red-500 ring-1 ring-red-400" : "border-transparent"}
                  focus:outline-none focus:ring-2 focus:ring-teal-400 transition`}
              />
              {loadingSugg && (
                <span className="absolute right-3 top-3.5 text-gray-400 text-base animate-spin select-none">⟳</span>
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
            <button type="button" onClick={useCurrentLocation}
              className="mt-2 text-xs text-teal-400 hover:text-teal-200 hover:underline transition">
              📍 Use current location
            </button>
            {locError && <p className="text-red-400 text-xs mt-1">⚠ Could not determine your location.</p>}
          </div>

          <div>
            <label className="text-sm opacity-80 block mb-1">Destination</label>
            <input value={collegeName} readOnly
              className="w-full p-3 rounded-lg text-black bg-white text-sm cursor-default" />
          </div>

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
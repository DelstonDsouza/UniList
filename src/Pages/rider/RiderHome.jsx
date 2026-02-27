// src/pages/rider/RiderHome.jsx

// ─── Imports ──────────────────────────────────────────────────────────────────
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet" // added useMap
import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import homeIcon from "../../assets/icons/home-icon.svg"
import exploreIcon from "../../assets/icons/explore-icon.svg"
import profileIcon from "../../assets/icons/profile-icon.svg"

// ─── FlyToLocation ────────────────────────────────────────────────────────────
// Must be OUTSIDE RiderHome — it's a react-leaflet child component
// Automatically flies the map to the user's GPS position once it loads
function FlyToLocation({ position }) {
  const map = useMap() // access the Leaflet map instance

  useEffect(() => {
    if (position) {
      // Smoothly animate map center to GPS coordinates
      map.flyTo(position, 16, { animate: true, duration: 1.2 })
    }
  }, [position, map])

  return null // renders nothing, just controls the map
}
// Recenters map when GPS coordinates arrive
// Uses setView instead of flyTo to avoid animation crash on static map
function RecenterMap({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, 16)
  }, [position])
  return null
}

// ─── MapEvents ────────────────────────────────────────────────────────────────
// Listens for clicks on the map to allow users to drop a pin anywhere
import { useMapEvents } from "react-leaflet"

function MapEvents({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

// ─── extractShortName ─────────────────────────────────────────────────────────
// Converts Nominatim reverse geocode response into a readable address
// Format: "Road Name, Neighbourhood, City"
// Example: "Devarapadau Cross Lane 2, Vamanjoor, Mangaluru"
const extractShortName = (data) => {
  const a = data.address || {}

  const road = a.road || ""  // street name
  const neighbourhood = a.neighbourhood || a.suburb || "" // area name
  const city = a.city || a.town || a.village || a.county || "" // city

  // Return most detailed format available
  if (road && neighbourhood && city) return `${road}, ${neighbourhood}, ${city}`
  if (road && city) return `${road}, ${city}`
  if (neighbourhood && city) return `${neighbourhood}, ${city}`
  if (city) return city

  // Last resort: first 3 parts of full display_name
  return data.display_name?.split(",").slice(0, 3).join(",").trim() ?? "Current Location"
}

// ─── formatTime ───────────────────────────────────────────────────────────────
// Converts 24h time input value (e.g. "08:35") to 12h display (e.g. "8:35 AM")
const formatTime = (time24) => {
  if (!time24) return ""
  const [h, m] = time24.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`
}

// ─── RiderHome ────────────────────────────────────────────────────────────────
export default function RiderHome() {

  // State: GPS coordinates [lat, lng]
  const [userLocation, setUserLocation] = useState(null)
  // State: human-readable address string
  const [locationName, setLocationName] = useState("Fetching location...")
  // State: departure time in 24h format from input
  const [departureTime, setDepartureTime] = useState("")
  // State: confirmation popup visibility
  const [showPopup, setShowPopup] = useState(false)
  // State: validation error flags
  const [timeError, setTimeError] = useState(false)
  const [locationError, setLocationError] = useState(false)

  const navigate = useNavigate()

  // Fixed college destination coordinates
  const collegeLocation = [12.872109642876621, 74.84534749009204]
  const collegeName = "St Aloysius College, Mangalore"

  // ─── Fetch GPS + Reverse Geocode ───────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude

        setUserLocation([lat, lng])

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            {
              headers: {
                "Accept-Language": "en",
                "User-Agent": "RideMate/1.0"   // Nominatim requires this
              }
            }
          )
          const data = await res.json()
          setLocationName(extractShortName(data))
        } catch {
          setLocationName("Current Location")
        }
      },
      () => {
        setLocationName("Location unavailable")
        alert("Please enable location permission")
      },
      {
        enableHighAccuracy: true,  // ← forces GPS chip, not WiFi/IP
        timeout: 10000,
        maximumAge: 0              // ← no cached position, always fresh
      }
    )
  }, [])

  // ─── Get current time as min value for time input ─────────────────────────
  // Prevents user from selecting past departure times
  const getMinTime = () => {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, "0")
    const minutes = now.getMinutes().toString().padStart(2, "0")
    return `${hours}:${minutes}`
  }

  // ─── Reverse: Geocode user-typed address back to coordinates ──────────────
  const handleLocationBlur = async () => {
    // If they cleared it, or it still says "Fetching", do nothing
    if (!locationName || locationName === "Fetching location..." || locationName === "Current Location") return

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "RideMate/1.0",
          },
        }
      )
      const data = await res.json()
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        setUserLocation([lat, lng]) // Updates the map pin!
        setLocationError(false)
        // Optionally update the name to the officially recognized format
        // setLocationName(extractShortName({ display_name: data[0].display_name }))
      }
    } catch (e) {
      console.error("Geocoding failed", e)
    }
  }

  // ─── Map Click to Select Location ─────────────────────────────────────────
  const handleMapClick = async (latlng) => {
    const [lat, lng] = latlng
    setUserLocation([lat, lng])
    setLocationName("Fetching location...")
    setLocationError(false)

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "RideMate/1.0"
          }
        }
      )
      const data = await res.json()
      setLocationName(extractShortName(data))
    } catch {
      setLocationName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    }
  }

  // ─── Validate form before showing popup ───────────────────────────────────
  const handleSearch = () => {
    let hasError = false

    // Must have GPS location
    if (!userLocation) { setLocationError(true); hasError = true }
    else setLocationError(false)

    // Must have departure time selected
    if (!departureTime) {
      setTimeError(true)
      hasError = true
    } else {
      // Check if selected time is in the past
      const [h, m] = departureTime.split(":").map(Number)
      const selected = new Date()
      selected.setHours(h, m, 0, 0)
      if (selected < new Date()) {
        setTimeError(true)
        hasError = true
      } else {
        setTimeError(false)
      }
    }

    if (hasError) return

    // All valid — show confirmation popup
    setShowPopup(true)
  }

  // ─── Navigate to searching screen on confirm ───────────────────────────────
  const handleConfirm = () => {
    console.log("departureTime value:", departureTime) // ADD THIS
    console.log("formatted:", formatTime(departureTime)) // ADD THIS
    setShowPopup(false)
    navigate("/rider-searching", {
      state: {
        userLocation,
        collegeLocation,
        departureTime: formatTime(departureTime), // pass formatted "8:35 PM" not "08:35"
      },
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 pb-24">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button className="text-2xl">☰</button>
        <h1 className="text-lg font-semibold">Welcome, Rider !</h1>
        <div className="w-9 h-9 bg-teal-400 rounded-full" />
      </div>

      {/* ── MAP ── */}
      {/* Shows a placeholder until GPS resolves, then renders map with pin */}
      <div className="mt-4 mx-4 rounded-3xl overflow-hidden shadow-sm">
        {userLocation ? (
          <MapContainer
            center={userLocation}  // initial center (GPS coords)
            zoom={15}
            style={{ height: "220px", width: "100%" }}
            dragging={true}         // ALLOW drag — interactive map
            zoomControl={true}
            scrollWheelZoom={true}
            doubleClickZoom={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapEvents onLocationSelect={handleMapClick} />

            {/* Blue pin at user's GPS location */}
            <Marker position={userLocation} />
            <RecenterMap position={userLocation} />

            {/* Fly map to GPS location once loaded */}
            <FlyToLocation position={userLocation} />
          </MapContainer>
        ) : (
          // Shown while GPS is loading
          <div
            className="flex items-center justify-center text-gray-400 text-sm"
            style={{ height: "220px", background: "#f1f5f9" }}
          >
            📍 Fetching your location...
          </div>
        )}
      </div>

      {/* ── CONFIRMATION POPUP ── */}
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-box bg-white">
            <h2>Post a ride?</h2>
            <div className="popup-actions">
              {/* Cancel closes popup */}
              <button className="cancel-btn" onClick={() => setShowPopup(false)}>
                Cancel
              </button>
              {/* Confirm navigates to searching screen */}
              <button className="confirm-btn" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POST RIDE CARD ── */}
      <div className="px-4 mt-5">
        <h2 className="font-semibold mb-3">Post a Ride</h2>

        <div
          className="p-5 rounded-2xl space-y-4 text-white"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
        >

          {/* Current Location — auto-filled from GPS + reverse geocode, but editable if GPS is wrong */}
          <div>
            <label className="text-sm opacity-80">Current Location</label>
            <input
              value={locationName}
              onChange={(e) => {
                setLocationName(e.target.value)
                setLocationError(false)
              }}
              onBlur={handleLocationBlur}
              className={`w-full p-3 rounded-lg text-black bg-white mt-1 border ${locationError ? "border-red-500" : "border-transparent"
                }`}
            />
            {locationError && (
              <p className="text-red-500 text-xs mt-1">Location not available</p>
            )}
          </div>

          {/* Destination — fixed to college */}
          <div>
            <label className="text-sm opacity-80">Destination</label>
            <input
              value={collegeName}
              readOnly
              className="w-full p-3 rounded-lg text-black bg-white mt-1"
            />
          </div>

          {/* Departure Time — time picker, no min restriction (validated on submit) */}
          <div>
            <label className="text-sm opacity-80">Departure Time</label>
            <input
              type="time"
              value={departureTime}
              min={getMinTime()}
              onChange={(e) => {
                setDepartureTime(e.target.value)
                setTimeError(false)
              }}
              className={`w-full p-3 rounded-lg text-black bg-white mt-1 border ${timeError ? "border-red-500" : "border-transparent"
                }`}
            />
            {timeError && (
              <p className="text-red-500 text-xs mt-1">
                Please select a valid future departure time
              </p>
            )}
          </div>

          {/* Search button — validates then shows popup */}
          <button
            onClick={handleSearch}
            className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-black font-medium py-3 rounded-xl transition"
          >
            Search for Passenger
          </button>

          {/* Saved Rides — placeholder for future feature */}
          <button className="mt-4 bg-gray-200 px-4 py-2 rounded-lg text-black">
            Saved Rides
          </button>

        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3">
        <div className="text-center">
          <img src={homeIcon} className="w-6 mx-auto mb-1" />
          <div className="text-sm font-medium">Home</div>
        </div>
        <div className="text-center text-gray-400">
          <img src={exploreIcon} className="w-6 mx-auto mb-1 opacity-60" />
          <div className="text-sm">History</div>
        </div>
        <div className="text-center text-gray-400">
          <img src={profileIcon} className="w-6 mx-auto mb-1 opacity-60" />
          <div className="text-sm">Account</div>
        </div>
      </div>

    </div>
  )
}
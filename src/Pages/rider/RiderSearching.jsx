// src/pages/rider/RiderSearching.jsx
// Posts ride to backend → navigates to RiderWait with rideId

import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect, useState, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { apiFetch } from "../../services/api"

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// OSRM route polyline (no leaflet-routing-machine)
function RoutePolyline({ from, to }) {
  const map = useMap()
  const [coords, setCoords] = useState([])

  useEffect(() => {
    if (!from || !to) return
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const route = data?.routes?.[0]
        if (!route) return
        const decoded = (route.geometry.coordinates || []).map(([lng, lat]) => [lat, lng])
        setCoords(decoded)
        if (decoded.length > 1) {
          try { map.fitBounds(L.latLngBounds(decoded), { padding: [48, 48] }) } catch {}
        }
      })
      .catch(() => {})
  }, [from, to, map])

  if (coords.length < 2) return null
  return <Polyline positions={coords} pathOptions={{ color: "#2563EB", weight: 5 }} />
}

export default function RiderSearching() {
  const location = useLocation()
  const navigate  = useNavigate()
  const {
    userLocation,
    collegeLocation,
    departureTime,
    departureTimeRaw,
  } = location.state || {}

  const [status, setStatus]   = useState("posting") // posting | waiting | error
  const [error,  setError]    = useState("")
  const [dots,   setDots]     = useState("")
  const rideIdRef             = useRef(null)

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 500)
    return () => clearInterval(t)
  }, [])

  // Post ride on mount
  useEffect(() => {
    if (!userLocation || !collegeLocation) return

    const postRide = async () => {
      try {
        setStatus("posting")
        const data = await apiFetch("/rides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentLat:   userLocation[0],
            currentLng:   userLocation[1],
            pickupLat:    userLocation[0],
            pickupLng:    userLocation[1],
            scooterNumber: "N/A",
          }),
        })
        rideIdRef.current = data?.data?.ride?._id
        setStatus("waiting")
      } catch (err) {
        setError(err.message || "Failed to post ride")
        setStatus("error")
      }
    }

    postRide()
  }, [])

  // Once ride is posted, navigate to RiderWait
  useEffect(() => {
    if (status !== "waiting" || !rideIdRef.current) return
    navigate(`/rider-wait/${rideIdRef.current}`, {
      state: {
        userLocation,
        collegeLocation,
        departureTime,
        departureTimeRaw,
      },
      replace: true,
    })
  }, [status])

  if (!userLocation || !collegeLocation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Missing location data. Go back and try again.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <MapContainer center={userLocation} zoom={13} style={{ height: "65vh", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={userLocation} />
        <Marker position={collegeLocation} />
        <RoutePolyline from={userLocation} to={collegeLocation} />
      </MapContainer>

      <div className="bg-white py-12 flex flex-col items-center gap-4 px-6">
        {status === "posting" && (
          <>
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-lg font-medium text-gray-700">Posting your ride{dots}</h2>
          </>
        )}
        {status === "waiting" && (
          <>
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-lg font-medium text-gray-700">Finding passengers{dots}</h2>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-500 font-medium">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-2 px-6 py-2 bg-gray-200 rounded-xl text-gray-700"
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
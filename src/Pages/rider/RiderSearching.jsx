// src/pages/rider/RiderSearching.jsx
// Posts ride to backend → navigates to RiderWait with rideId

import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect, useState, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { apiFetch } from "../../services/api"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

function RoutePolyline({ from, to }) {
  const map = useMap()
  const [coords, setCoords] = useState([])

  useEffect(() => {
    if (!from || !to) return
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const decoded = (data?.routes?.[0]?.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng])
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
    liveGpsLocation,
    collegeLocation,
    departureTime,
    departureTimeRaw,
    riderName,
    riderPhone,
    scooterNumber,
  } = location.state || {}

  // Rider's actual GPS for server currentLat/Lng; pinned location for pickupLat/Lng
  const currentGps = liveGpsLocation || userLocation

  const [status, setStatus] = useState("posting")
  const [error,  setError]  = useState("")
  const [dots,   setDots]   = useState("")

  // ── Guards against React StrictMode double-invoke ────────────────────────
  const hasPosted   = useRef(false)  // prevents double POST
  const rideIdRef   = useRef(null)
  const mountedRef  = useRef(true)

  useEffect(() => {
    const t = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!userLocation || !collegeLocation) return
    if (hasPosted.current) return   // ← StrictMode guard: only post once
    hasPosted.current = true

    const postRide = async () => {
      try {
        setStatus("posting")
        const data = await apiFetch("/rides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            riderName:     riderName     || "",
            riderPhone:    riderPhone    || "",
            scooterNumber: scooterNumber || "N/A",
            currentLat:    (currentGps || userLocation)[0],
            currentLng:    (currentGps || userLocation)[1],
            pickupLat:     userLocation[0],   // pinned pickup point
            pickupLng:     userLocation[1],
            departureTime: departureTimeRaw || null,
          }),
        })

        const rideId = data?.data?.ride?._id
        if (!rideId) throw new Error("No ride ID returned from server")

        rideIdRef.current = rideId
        if (!mountedRef.current) return

        setStatus("waiting")

        // Navigate immediately to RiderWait
        navigate(`/rider-wait/${rideId}`, {
          state: {
            userLocation,
            collegeLocation,
            departureTime,
            departureTimeRaw,
          },
          replace: true,
        })

      } catch (err) {
        if (!mountedRef.current) return
        hasPosted.current = false  // allow retry on error
        setError(err.message || "Failed to post ride")
        setStatus("error")
      }
    }

    postRide()
  }, [])  // empty deps — intentional, guard handles StrictMode

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
            <p className="text-red-500 font-medium text-center">{error}</p>
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
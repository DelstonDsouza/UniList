// src/pages/rider/RiderWait.jsx

import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { socket, connectSocket, disconnectSocket } from "../../services/socket"
import { apiFetch } from "../../services/api"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const pickupIcon = new L.DivIcon({
  html: `<div style="background:#2563EB;color:white;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);width:36px;height:36px;border:3px solid white;
    box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);font-size:15px">📍</span></div>`,
  className: "", iconSize: [36, 36], iconAnchor: [18, 36],
})

const collegeIcon = new L.DivIcon({
  html: `<div style="background:#0d9488;color:white;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);width:36px;height:36px;border:3px solid white;
    box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);font-size:15px">🎓</span></div>`,
  className: "", iconSize: [36, 36], iconAnchor: [18, 36],
})

// ── Fetches OSRM route and draws blue polyline ────────────────────────────────
function RoutePolyline({ from, to }) {
  const map = useMap()
  const [coords, setCoords] = useState([])

  useEffect(() => {
    if (!from || !to) return
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const decoded = (data?.routes?.[0]?.geometry?.coordinates || [])
          .map(([lng, lat]) => [lat, lng])
        setCoords(decoded)
        if (decoded.length > 1) {
          try { map.fitBounds(L.latLngBounds(decoded), { padding: [60, 60] }) } catch { }
        }
      })
      .catch(() => { })
  }, [from, to, map])

  if (coords.length < 2) return null
  return (
    <Polyline
      positions={coords}
      pathOptions={{ color: "#2563EB", weight: 5, opacity: 0.85 }}
    />
  )
}

export default function RiderWait() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const { userLocation, collegeLocation, departureTime, departureTimeRaw } = location.state || {}

  const [dots, setDots] = useState("")
  const [passengerJoined, setPassengerJoined] = useState(false)
  const [showCancelPopup, setShowCancelPopup] = useState(false)
  const [showNoPassenger, setShowNoPassenger] = useState(false)  // fires when departure time passes

  const navigatedRef = useRef(false)
  const watchIdRef = useRef(null)
  const locationEmitRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 500)
    return () => clearInterval(t)
  }, [])

  // ── Departure time countdown: when it hits 0, show "No passengers found" popup ──
  useEffect(() => {
    if (!departureTime && !departureTimeRaw) return
    const raw = departureTimeRaw || departureTime

    // Parse "8:35 AM" or "08:35"
    const parse = (str) => {
      const ampm = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      const h24 = str.trim().match(/^(\d{1,2}):(\d{2})$/)
      let h, m
      if (ampm) {
        h = parseInt(ampm[1]); m = parseInt(ampm[2])
        const p = ampm[3].toUpperCase()
        if (p === "PM" && h !== 12) h += 12
        if (p === "AM" && h === 12) h = 0
      } else if (h24) {
        h = parseInt(h24[1]); m = parseInt(h24[2])
      } else return null
      const d = new Date(); d.setHours(h, m, 0, 0)
      return d
    }

    const target = parse(raw)
    if (!target) return

    const tick = () => {
      const diff = Math.round((target - Date.now()) / 1000)
      if (diff <= 0 && !passengerJoined && !navigatedRef.current) {
        setShowNoPassenger(true)
        clearInterval(id)
      }
    }
    const id = setInterval(tick, 1000)
    tick() // run immediately too
    return () => clearInterval(id)
  }, [departureTime, departureTimeRaw, passengerJoined])

  // ── Socket: join room + listen for passenger accepting ────────────────────
  useEffect(() => {
    if (!id) return
    connectSocket()
    socket.emit("join:ride", id)

    const handleLocked = (data) => {
      if (navigatedRef.current) return
      navigatedRef.current = true
      setPassengerJoined(true)
      setTimeout(() => {
        navigate("/ride-confirmed", {
          state: {
            rideId: data.rideId,
            userLocation,
            collegeLocation,
            departureTime,
            departureTimeRaw,
            passengerName: data.passengerName,
            passengerPhone: data.passengerPhone,
            passengerLat: data.passengerLat,
            passengerLng: data.passengerLng,
            fare: data.fare,
            distanceKm: data.distanceKm,
          },
        })
      }, 1200)
    }

    socket.on("ride:locked", handleLocked)
    return () => socket.off("ride:locked", handleLocked)
  }, [id])

  // ── GPS watch — only broadcasts live location to passenger via socket ─────
  useEffect(() => {
    if (!id || !navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      () => { },
      () => { },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    )

    locationEmitRef.current = setInterval(() => {
      if (!socket.connected) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          socket.emit("rider:location", {
            rideId: id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          })
        },
        () => { },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
      )
    }, 4000)

    return () => {
      navigator.geolocation.clearWatch(watchIdRef.current)
      clearInterval(locationEmitRef.current)
    }
  }, [id])

  const pickupCoords = userLocation || [12.9141, 74.8560]
  const collegeCoords = collegeLocation || [12.8721, 74.8453]

  return (
    <div className="fixed inset-0 bg-white overflow-hidden">

      {/* NO PASSENGERS FOUND POPUP */}
      {showNoPassenger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center w-[88%] max-w-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Passengers Found</h2>
            <p className="text-gray-500 text-sm mb-6">
              Departure time expired and no one joined the ride.
            </p>
            <button
              onClick={async () => {
                try {
                  await apiFetch(`/rides/${id}/cancel`, { method: "POST" })
                } catch { }
                clearInterval(locationEmitRef.current)
                navigator.geolocation.clearWatch(watchIdRef.current)
                disconnectSocket(true)
                navigate("/rider-home", { replace: true })
              }}
              className="w-full py-3 rounded-2xl bg-gray-900 text-white font-semibold text-base hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* CANCEL POPUP */}
      {showCancelPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-7 rounded-2xl shadow-xl text-center w-[90%] max-w-sm">
            <h2 className="text-xl font-semibold mb-3">Cancel the ride?</h2>
            <p className="text-gray-500 text-sm mb-6">This will remove your ride post.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelPopup(false)}
                className="flex-1 py-3 rounded-xl bg-gray-200 font-medium">No</button>
              <button
                onClick={async () => {
                  try {
                    await apiFetch(`/rides/${id}/cancel`, { method: "POST" })
                  } catch (err) {
                    console.error("Cancel failed:", err.message)
                  }
                  clearInterval(locationEmitRef.current)
                  navigator.geolocation.clearWatch(watchIdRef.current)
                  disconnectSocket(true)
                  await new Promise(r => setTimeout(r, 400))
                  navigate("/rider-home", { replace: true })
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium">
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS PILL */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-max">
        <div className={`px-5 py-2 rounded-full border text-white text-center transition-all
          ${passengerJoined ? "bg-green-600 border-green-500" : "bg-black/60 backdrop-blur-md border-white/10"}`}>
          <p className="text-sm font-semibold">
            {passengerJoined ? "✓ Passenger found!" : `Looking for passengers${dots}`}
          </p>
          <p className="text-xs text-white/70">
            {passengerJoined ? "Taking you to confirmation…" : ""}
          </p>
        </div>
      </div>

      {/* MAP — route from pickup → college */}
      <div className="absolute top-0 left-0 right-0 h-[55vh] z-0">
        <MapContainer
          center={pickupCoords}
          zoom={13}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />

          {/* Pickup marker — rider's chosen location */}
          <Marker position={pickupCoords} icon={pickupIcon} />

          {/* College destination marker */}
          <Marker position={collegeCoords} icon={collegeIcon} />

          {/* Blue route polyline pickup → college */}
          <RoutePolyline from={pickupCoords} to={collegeCoords} />
        </MapContainer>
      </div>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-0 w-full px-5 pb-6 z-10">
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-lg space-y-5">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your trip</p>
            <p className="text-xs text-gray-400">Departure</p>
            <p className="font-semibold">{departureTime || "ASAP"}</p>
          </div>

          <div className="pt-3 border-t border-gray-100">
            {!passengerJoined ? (
              <>
                <p className="font-medium text-sm text-gray-700">No passengers yet</p>
                <p className="text-xs text-gray-400 mt-1">Searching nearby students{dots}</p>
              </>
            ) : (
              <p className="font-semibold text-green-600 animate-pulse">
                ✓ Passenger found — redirecting…
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowCancelPopup(true)}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-red-500 font-medium">
              Cancel Ride
            </button>
            <button disabled
              className="flex-1 py-3 rounded-xl bg-blue-400/40 text-white font-medium cursor-not-allowed">
              {passengerJoined ? "Confirmed!" : `Waiting${dots}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
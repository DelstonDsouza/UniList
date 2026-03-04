// src/pages/rider/RiderWait.jsx

import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { socket, connectSocket, disconnectSocket } from "../../services/socket"
import { apiFetch } from "../../services/api"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const pickupIcon = new L.DivIcon({
  html: `<div style="background:#2563EB;color:white;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);width:36px;height:36px;border:3px solid white;
    box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);font-size:15px">📍</span></div>`,
  className: "", iconSize: [36, 36], iconAnchor: [18, 36],
})

export default function RiderWait() {
  const { id }   = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const { userLocation, collegeLocation, departureTime, departureTimeRaw } = location.state || {}

  const [dots,            setDots]            = useState("")
  const [passengerJoined, setPassengerJoined] = useState(false)
  const [showCancelPopup, setShowCancelPopup] = useState(false)

  const navigatedRef    = useRef(false)
  const watchIdRef      = useRef(null)
  const locationEmitRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 500)
    return () => clearInterval(t)
  }, [])

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
            rideId:         data.rideId,
            userLocation,
            collegeLocation,
            departureTime,
            departureTimeRaw,
            passengerName:  data.passengerName,
            passengerPhone: data.passengerPhone,
            passengerLat:   data.passengerLat,
            passengerLng:   data.passengerLng,
            fare:           data.fare,
            distanceKm:     data.distanceKm,
          },
        })
      }, 1200)
    }

    socket.on("ride:locked", handleLocked)
    return () => socket.off("ride:locked", handleLocked)
  }, [id])

  // ── GPS watch — only broadcasts live location to passenger via socket ─────
  // Does NOT update any map state — pickup pin is fixed from RiderHome
  useEffect(() => {
    if (!id || !navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      () => {}, // no state update — map stays fixed on pickup pin
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    )

    // Emit live location to passenger every 4s
    locationEmitRef.current = setInterval(() => {
      if (!socket.connected) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          socket.emit("rider:location", {
            rideId: id,
            lat:    pos.coords.latitude,
            lng:    pos.coords.longitude,
          })
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
      )
    }, 4000)

    return () => {
      navigator.geolocation.clearWatch(watchIdRef.current)
      clearInterval(locationEmitRef.current)
    }
  }, [id])

  // Pickup pin = what rider chose on map in RiderHome — fixed, never changes
  const pickupCoords = userLocation || [12.9141, 74.8560]

  return (
    <div className="fixed inset-0 bg-white overflow-hidden">

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
            {passengerJoined ? "Taking you to confirmation…" : "📡 Broadcasting your location live"}
          </p>
        </div>
      </div>

      {/* MAP — single pickup pin only */}
      <div className="absolute top-0 left-0 right-0 h-[55vh] z-0">
        <MapContainer center={pickupCoords} zoom={14} zoomControl={false}
          style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>' />
          <Marker position={pickupCoords} icon={pickupIcon} />
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

          <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 rounded-xl px-3 py-2">
            <span className="text-blue-500">📍</span>
            <span>Pickup pin set — passengers matched to this point</span>
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
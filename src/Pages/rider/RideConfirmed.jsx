// src/pages/rider/RideConfirmed.jsx
import { useEffect, useMemo, useCallback } from "react"
import { MapContainer, TileLayer, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-routing-machine"
import "leaflet-routing-machine/dist/leaflet-routing-machine.css"
import L from "leaflet"
import { useLocation, useNavigate } from "react-router-dom"
import { useRide } from "../../context/RideContext"
import { createRide } from "../../services/rideService"
import SwipeButton from "../../components/ui/SwipeButton"

function RoutingLayer({ waypoints }) {
  const map = useMap()
  useEffect(() => {
    if (!map || waypoints.length < 2) return
    const control = L.Routing.control({
      waypoints: waypoints.map(([lat, lng]) => L.latLng(lat, lng)),
      lineOptions: { styles: [{ color: "#2563EB", weight: 5, opacity: 0.85 }] },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
      createMarker: () => null,
    }).addTo(map)
    return () => { try { map.removeControl(control) } catch { } }
  }, [map])
  return null
}

const makePin = (color, emoji) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;">${emoji}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  })

function PinMarker({ position, color, emoji, label }) {
  const map = useMap()
  useEffect(() => {
    const m = L.marker(position, { icon: makePin(color, emoji) }).addTo(map)
    if (label) m.bindTooltip(label, { permanent: false })
    return () => m.remove()
  }, [map])
  return null
}

export default function RideConfirmed() {
  const location = useLocation()
  const navigate = useNavigate()
  const { ride, setRide } = useRide()

  const {
    userLocation,
    collegeLocation,
    passengerPickup = [12.94, 74.84],
    passengerName = "Rahul Sharma",
    passengerRating = 4.8,
    passengerLocation = "Kulasekara",
    distance = "5.4",
    fare = "120",
    departureTime = "",
  } = location.state || {}

  useEffect(() => {
    if (!userLocation || !collegeLocation) return
    if (ride.rideId) return
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    createRide({
      riderId: user.uid || user.id || "unknown",
      riderName: user.name || user.displayName || "Rider",
      origin: { lat: userLocation[0], lng: userLocation[1], label: "Your location" },
      destination: { lat: collegeLocation[0], lng: collegeLocation[1], label: "College" },
      departureTime,
    }).then(({ rideId, otp }) => {
      setRide({
        rideId,
        otp,
        status: "matched",
        origin: { lat: userLocation[0], lng: userLocation[1] },
        destination: { lat: collegeLocation[0], lng: collegeLocation[1], label: "College" },
        passengerName,
        passengerRating: Number(passengerRating),
        passengerPickup: { lat: passengerPickup[0], lng: passengerPickup[1], label: passengerLocation },
        distance: Number(distance),
        fare: Number(fare),
        departureTime,
      })
    }).catch(console.error)
  }, [])

  const handleSwipe = useCallback(() => navigate("/rider-otp-verify"), [navigate])
  const center = userLocation ?? [12.9141, 74.8560]
  const waypoints = useMemo(() => [userLocation, passengerPickup, collegeLocation].filter(Boolean), [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div style={{ height: "52vh", width: "100%", flexShrink: 0 }}>
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {userLocation && <PinMarker position={userLocation} color="#2563EB" emoji="🏍" label="You" />}
          {passengerPickup && <PinMarker position={passengerPickup} color="#16a34a" emoji="P" label={passengerName} />}
          {collegeLocation && <PinMarker position={collegeLocation} color="#DC2626" emoji="🎓" label="College" />}
          <RoutingLayer waypoints={waypoints} />
        </MapContainer>
      </div>

      <div className="flex-1 bg-white px-5 pt-5 pb-8 flex flex-col gap-4" style={{ borderRadius: "24px 24px 0 0", marginTop: -20, boxShadow: "0 -4px 24px rgba(0,0,0,0.08)", position: "relative", zIndex: 10 }}>
        <div className="flex justify-center -mt-1 mb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-0.5">Passenger Found</p>
            <h2 className="text-xl font-bold text-gray-900">Ride Confirmed</h2>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg">✓</div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "#F0F9FF", border: "1.5px solid #BFDBFE" }}>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Passenger Details</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}>
                {passengerName.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900">{passengerName}</p>
                <p className="text-sm text-gray-500">📍 {passengerLocation}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-yellow-400 text-lg">★</span>
              <span className="font-semibold text-gray-700 text-sm">{passengerRating}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "#F8FAFF", border: "1.5px solid #E0EAFF" }}>
            <p className="text-xs text-gray-400 mb-0.5">Distance</p>
            <p className="text-base font-bold text-gray-800">{distance} km</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
            <p className="text-xs text-gray-400 mb-0.5">You Earn</p>
            <p className="text-base font-bold text-green-600">₹{fare}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "#FFF7ED", border: "1.5px solid #FED7AA" }}>
            <p className="text-xs text-gray-400 mb-0.5">Departs</p>
            <p className="text-sm font-bold text-orange-600">{departureTime || "Now"}</p>
          </div>
        </div>

        <div className="rounded-xl p-3 flex items-start gap-3" style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
          <span className="text-xl mt-0.5">🔐</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">OTP Required at Pickup</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">Ask your passenger for their 4-digit OTP when you arrive. Enter it on the next screen.</p>
          </div>
        </div>

        <SwipeButton label="Swipe to Go Pick Up →" onSwipeComplete={handleSwipe} color="#16a34a" />
      </div>
    </div>
  )
}
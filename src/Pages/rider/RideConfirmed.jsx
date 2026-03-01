// src/pages/rider/RideConfirmed.jsx
// Shows real passenger details from ride — no fake data

import { useEffect, useMemo, useCallback, useRef, useState } from "react"
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useLocation, useNavigate } from "react-router-dom"

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// Custom pin marker
function PinMarker({ position, color, emoji, label }) {
  const map = useMap()
  useEffect(() => {
    if (!position) return
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:${color};width:36px;height:36px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:14px">${emoji}</span></div>`,
      iconSize: [36, 36], iconAnchor: [18, 36],
    })
    const m = L.marker(position, { icon }).addTo(map)
    if (label) m.bindTooltip(label, { permanent: false, direction: "top" })
    return () => { try { m.remove() } catch {} }
  }, [position?.[0], position?.[1], map]) // eslint-disable-line
  return null
}

// OSRM route polyline
function RoutePolyline({ waypoints }) {
  const map = useMap()
  const [coords, setCoords] = useState([])
  const abortRef = useRef(null)

  useEffect(() => {
    const pts = waypoints.filter(Boolean)
    if (pts.length < 2) return
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const stops = pts.map(([lat, lng]) => `${lng},${lat}`).join(";")
    fetch(`https://router.project-osrm.org/route/v1/driving/${stops}?overview=full&geometries=geojson`,
      { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        const route = data?.routes?.[0]
        if (!route) return
        const decoded = (route.geometry.coordinates || []).map(([lng, lat]) => [lat, lng])
        setCoords(decoded)
        if (decoded.length > 1) {
          try { map.fitBounds(L.latLngBounds(decoded), { padding: [48, 48], animate: true }) } catch {}
        }
      })
      .catch(e => { if (e.name !== "AbortError") console.warn("Route error:", e) })
    return () => ctrl.abort()
  }, [waypoints.map(w => w?.join()).join("|"), map]) // eslint-disable-line

  if (coords.length < 2) return null
  return <Polyline positions={coords} pathOptions={{ color: "#2563EB", weight: 5, opacity: 0.85 }} />
}

export default function RideConfirmed() {
  const location = useLocation()
  const navigate  = useNavigate()

  const {
    rideId,
    userLocation,
    collegeLocation,
    departureTime,
    departureTimeRaw,
    passengerName     = "Passenger",
    passengerPhone    = "",
    passengerLat      = null,
    passengerLng      = null,
    fare              = 0,
    distanceKm        = 0,
  } = location.state || {}

  const passengerPickup = passengerLat && passengerLng ? [passengerLat, passengerLng] : null

  // Departure time lock
  const [canDepart,   setCanDepart]   = useState(!departureTimeRaw)
  const [departLabel, setDepartLabel] = useState(departureTime || "Now")

  useEffect(() => {
    if (!departureTimeRaw) { setCanDepart(true); return }

    const check = () => {
      const [h, m] = departureTimeRaw.split(":").map(Number)
      const target = new Date()
      target.setHours(h, m, 0, 0)
      if (new Date() >= target) {
        setCanDepart(true)
        setDepartLabel("Now")
      } else {
        setCanDepart(false)
        setDepartLabel(departureTime || departureTimeRaw)
      }
    }
    check()
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
  }, [departureTimeRaw, departureTime])

  const waypoints = useMemo(
    () => [userLocation, passengerPickup, collegeLocation].filter(Boolean),
    [userLocation, passengerPickup, collegeLocation]
  )

  const center = userLocation ?? collegeLocation ?? [12.9141, 74.8560]

  const handleStartRide = useCallback(() => {
    navigate("/ride-pickup", {
      state: {
        rideId,
        userLocation,
        collegeLocation,
        passengerPickup,
        passengerName,
        passengerPhone,
        fare,
        distanceKm,
        departureTime,
      },
    })
  }, [navigate, rideId, userLocation, collegeLocation, passengerPickup,
      passengerName, passengerPhone, fare, distanceKm, departureTime])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* MAP */}
      <div style={{ height: "52vh", width: "100%", flexShrink: 0 }}>
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RoutePolyline waypoints={waypoints} />
          {userLocation    && <PinMarker position={userLocation}    color="#2563EB" emoji="🏍" label="You" />}
          {passengerPickup && <PinMarker position={passengerPickup} color="#16a34a" emoji="👤" label={passengerName} />}
          {collegeLocation && <PinMarker position={collegeLocation} color="#DC2626" emoji="🎓" label="College" />}
        </MapContainer>
      </div>

      {/* BOTTOM SHEET */}
      <div className="flex-1 bg-white px-5 pt-5 pb-8 flex flex-col gap-4"
        style={{ borderRadius: "24px 24px 0 0", marginTop: -20,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)", position: "relative", zIndex: 10 }}>

        {/* Handle */}
        <div className="flex justify-center -mt-1 mb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-0.5">
              Passenger Found
            </p>
            <h2 className="text-xl font-bold text-gray-900">Ride Confirmed</h2>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg">✓</div>
        </div>

        {/* Passenger card */}
        <div className="rounded-2xl p-4" style={{ background: "#F0F9FF", border: "1.5px solid #BFDBFE" }}>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
            Passenger Details
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}>
                {passengerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-gray-900">{passengerName}</p>
                {passengerPhone && (
                  <p className="text-sm text-gray-500">📞 {passengerPhone}</p>
                )}
                {passengerPickup && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    📍 {passengerLat?.toFixed(4)}, {passengerLng?.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "#F8FAFF", border: "1.5px solid #E0EAFF" }}>
            <p className="text-xs text-gray-400 mb-0.5">Distance</p>
            <p className="text-base font-bold text-gray-800">{Number(distanceKm).toFixed(1)} km</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
            <p className="text-xs text-gray-400 mb-0.5">You Earn</p>
            <p className="text-base font-bold text-green-600">₹{fare}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "#FFF7ED", border: "1.5px solid #FED7AA" }}>
            <p className="text-xs text-gray-400 mb-0.5">Departs</p>
            <p className="text-sm font-bold text-orange-600">{departLabel}</p>
          </div>
        </div>

        {/* OTP reminder */}
        <div className="rounded-xl p-3 flex items-start gap-3"
          style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
          <span className="text-xl mt-0.5">🔐</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">OTP Required at Pickup</p>
            <p className="text-xs text-amber-700 mt-0.5">Ask your passenger for their 4-digit OTP.</p>
          </div>
        </div>

        {/* Go pick up button */}
        <button
          onClick={handleStartRide}
          disabled={!canDepart}
          className={`w-full py-4 rounded-2xl font-bold text-white text-base transition
            ${canDepart
              ? "bg-green-600 hover:bg-green-700 active:scale-95"
              : "bg-gray-300 cursor-not-allowed text-gray-500"}`}
        >
          {canDepart ? "Go Pick Up Passenger →" : `Wait until ${departLabel}`}
        </button>
      </div>
    </div>
  )
}
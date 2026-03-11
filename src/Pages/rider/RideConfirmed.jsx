// src/pages/rider/RideConfirmed.jsx

import { useEffect, useMemo, useCallback, useRef, useState } from "react"
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useLocation, useNavigate } from "react-router-dom"
import { apiFetch } from "../../services/api"
import SwipeButton from "../../components/ui/SwipeButton"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    )
    const data = await res.json()
    const a = data.address || {}
    const parts = [
      a.road || a.pedestrian || a.footway || "",
      a.neighbourhood || a.suburb || a.village || "",
      a.city || a.town || a.county || "",
    ].filter(Boolean)
    return parts.length > 0
      ? parts.join(", ")
      : data.display_name?.split(",").slice(0, 3).join(",").trim()
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

function PinMarker({ position, color, emoji, label }) {
  const map = useMap()
  useEffect(() => {
    if (!position) return
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:${color};width:38px;height:38px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:15px">${emoji}</span></div>`,
      iconSize: [38, 38], iconAnchor: [19, 38],
    })
    const m = L.marker(position, { icon }).addTo(map)
    if (label) m.bindTooltip(label, { permanent: true, direction: "top", offset: [0, -40] })
    return () => { try { m.remove() } catch { } }
  }, [position?.[0], position?.[1], map]) // eslint-disable-line
  return null
}

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
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${stops}?overview=full&geometries=geojson`,
      { signal: ctrl.signal }
    )
      .then(r => r.json())
      .then(data => {
        const decoded = (data?.routes?.[0]?.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng])
        setCoords(decoded)
        if (decoded.length > 1) {
          try { map.fitBounds(L.latLngBounds(decoded), { padding: [52, 52], animate: true }) } catch { }
        }
      })
      .catch(e => { if (e.name !== "AbortError") console.warn("Route error:", e) })
    return () => ctrl.abort()
  }, [waypoints.map(w => w?.join()).join("|"), map]) // eslint-disable-line

  if (coords.length < 2) return null
  return <Polyline positions={coords} pathOptions={{ color: "#2563EB", weight: 5, opacity: 0.9 }} />
}

const COLLEGE = [12.8698, 74.8425]

export default function RideConfirmed() {
  const location = useLocation()
  const navigate = useNavigate()

  const {
    rideId,
    userLocation,
    collegeLocation,
    departureTime,
    departureTimeRaw,
    passengerName = "Passenger",
    passengerPhone = "",
    passengerLat = null,
    passengerLng = null,
    fare = 0,
    distanceKm = 0,
  } = location.state || {}

  const destination = collegeLocation || COLLEGE
  const passengerPickup = passengerLat && passengerLng
    ? [Number(passengerLat), Number(passengerLng)] : null

  const [riderAddress, setRiderAddress] = useState("Getting location…")
  const [passengerAddress, setPassengerAddress] = useState("Getting location…")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (userLocation?.[0] && userLocation?.[1])
      reverseGeocode(userLocation[0], userLocation[1]).then(setRiderAddress)
  }, [userLocation?.[0], userLocation?.[1]]) // eslint-disable-line

  useEffect(() => {
    if (passengerLat && passengerLng)
      reverseGeocode(Number(passengerLat), Number(passengerLng)).then(setPassengerAddress)
    else
      setPassengerAddress("Location not available")
  }, [passengerLat, passengerLng])

  const [canDepart, setCanDepart] = useState(!departureTimeRaw)
  const [departLabel, setDepartLabel] = useState(departureTime || "Now")

  useEffect(() => {
    if (!departureTimeRaw) { setCanDepart(true); return }
    const check = () => {
      const [h, m] = departureTimeRaw.split(":").map(Number)
      const target = new Date(); target.setHours(h, m, 0, 0)
      if (new Date() >= target) { setCanDepart(true); setDepartLabel("Now") }
      else { setCanDepart(false); setDepartLabel(departureTime || departureTimeRaw) }
    }
    check()
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
  }, [departureTimeRaw, departureTime])

  const waypoints = useMemo(
    () => [userLocation, passengerPickup, destination].filter(Boolean),
    [userLocation, passengerPickup, destination]
  )

  const center = userLocation ?? passengerPickup ?? destination

  const handleGoPickUp = useCallback(async () => {
    if (!rideId) return
    setLoading(true)
    setError("")
    try {
      await apiFetch(`/rides/${rideId}/pickup-start`, { method: "POST" })
      navigate("/ride-pickup", {
        state: {
          rideId,
          userLocation,
          collegeLocation: destination,
          passengerPickup,
          passengerName,
          passengerPhone,
          fare,
          distanceKm,
          departureTime,
        },
      })
    } catch (err) {
      setError(err.message || "Failed to start pickup. Try again.")
      setLoading(false)
    }
  }, [rideId, navigate, userLocation, destination, passengerPickup,
    passengerName, passengerPhone, fare, distanceKm, departureTime])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div style={{ height: "52vh", width: "100%", flexShrink: 0 }}>
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxZoom={20}
          />
          <RoutePolyline waypoints={waypoints} />
          {userLocation && <PinMarker position={userLocation} color="#2563EB" emoji="🏍" label="You" />}
          {passengerPickup && <PinMarker position={passengerPickup} color="#16a34a" emoji="👤" label={passengerName} />}
          <PinMarker position={destination} color="#DC2626" emoji="🎓" label="St Aloysius" />
        </MapContainer>
      </div>

      <div className="flex-1 bg-white px-5 pt-5 pb-8 flex flex-col gap-4"
        style={{
          borderRadius: "24px 24px 0 0", marginTop: -20,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)", position: "relative", zIndex: 10
        }}>

        <div className="flex justify-center -mt-1 mb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-0.5">Passenger Found</p>
            <h2 className="text-xl font-bold text-gray-900">Ride Confirmed</h2>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg font-bold text-green-600">✓</div>
        </div>

        <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100 space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <div className="w-0.5 h-8 bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <div className="w-0.5 h-8 bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs text-gray-400 font-medium">Your location</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug">{riderAddress}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Pickup — {passengerName}</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug">{passengerAddress}</p>
                {passengerPhone && (
                  <a href={`tel:${passengerPhone}`} className="text-xs text-blue-600 font-medium mt-0.5 inline-block">
                    {passengerPhone}
                  </a>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Destination</p>
                <p className="text-sm font-semibold text-gray-800">St Aloysius College, Mangalore</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center bg-blue-50 border border-blue-100">
            <p className="text-xs text-gray-400 mb-0.5">Distance</p>
            <p className="text-base font-bold text-gray-800">{Number(distanceKm).toFixed(1)} km</p>
          </div>
          <div className="rounded-xl p-3 text-center bg-green-50 border border-green-100">
            <p className="text-xs text-gray-400 mb-0.5">You Earn</p>
            <p className="text-base font-bold text-green-600">₹{fare}</p>
          </div>
          <div className="rounded-xl p-3 text-center bg-orange-50 border border-orange-100">
            <p className="text-xs text-gray-400 mb-0.5">Departs</p>
            <p className="text-sm font-bold text-orange-600">{departLabel}</p>
          </div>
        </div>

        <div className="rounded-xl p-3 flex items-start gap-3 bg-amber-50 border border-amber-200">
          <div>
            <p className="text-sm font-semibold text-amber-800">OTP Required at Pickup</p>
            <p className="text-xs text-amber-700 mt-0.5">Ask your passenger for their 4-digit OTP when you arrive.</p>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        {canDepart ? (
          <SwipeButton
            label="Slide to Go Pick Up Passenger"
            color="#16a34a"
            disabled={loading}
            onSwipeComplete={handleGoPickUp}
          />
        ) : (
          <div className="w-full py-4 rounded-2xl bg-gray-100 text-center text-gray-500 font-semibold text-sm">
            Wait until {departLabel}
          </div>
        )}
      </div>
    </div>
  )
}
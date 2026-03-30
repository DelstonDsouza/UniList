// src/pages/rider/RideConfirmed.jsx

import { useEffect, useMemo, useCallback, useRef, useState } from "react"
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { apiFetch } from "../../services/api"
import SwipeButton from "../../components/ui/SwipeButton"
import { Compass, Clock, User } from "lucide-react"
import { motion } from "framer-motion"

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
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [rideData, setRideData] = useState(location.state || null)
  const [loading, setLoading] = useState(!rideData)
  const [error, setError] = useState("")

  // Location names
  const [riderAddress, setRiderAddress] = useState("Getting location…")
  const [passengerAddress, setPassengerAddress] = useState("Getting location…")

  // Fetch ride if not in state
  useEffect(() => {
    if (rideData && rideData.passengerLat && rideData.passengerLng) return
    setLoading(true)
    apiFetch(`/rides/${id}`)
      .then(res => {
        const r = res.data.ride
        const mapped = {
          rideId: r._id,
          userLocation: r.currentLocation?.coordinates ? [r.currentLocation.coordinates[1], r.currentLocation.coordinates[0]] : null,
          collegeLocation: COLLEGE,
          departureTime: r.departureTimeStr || r.departureTime,
          departureTimeRaw: r.departureTime,
          passengerName: r.passenger?.name || "Passenger",
          passengerPhone: r.passenger?.phone || "",
          passengerLat: r.passenger?.location?.coordinates?.[1] || null,
          passengerLng: r.passenger?.location?.coordinates?.[0] || null,
          fare: r.fare?.amount || 0,
          distanceKm: r.fare?.distanceKm || 0,
        }
        setRideData(mapped)
        setLoading(false)
      })
      .catch(err => {
        console.error("Fetch ride failed:", err)
        setError("Could not load ride details.")
        setLoading(false)
      })
  }, [id]) // eslint-disable-line

  const {
    rideId = id,
    userLocation = null,
    collegeLocation = COLLEGE,
    departureTime = "",
    departureTimeRaw = "",
    passengerName = "Passenger",
    passengerPhone = "",
    passengerLat = null,
    passengerLng = null,
    fare = 0,
    distanceKm = 0,
  } = rideData || {}

  const destination = collegeLocation || COLLEGE
  const passengerPickup = passengerLat && passengerLng
    ? [Number(passengerLat), Number(passengerLng)] : null

  // \u2500\u2500 Prevent Back Navigation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  useEffect(() => {
    window.history.pushState(null, "", window.location.href)
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    if (userLocation?.[0] && userLocation?.[1])
      reverseGeocode(userLocation[0], userLocation[1]).then(setRiderAddress)
  }, [userLocation?.[0], userLocation?.[1]]) // eslint-disable-line

  useEffect(() => {
    if (passengerLat && passengerLng)
      reverseGeocode(Number(passengerLat), Number(passengerLng)).then(setPassengerAddress)
    else if (!loading)
      setPassengerAddress("Location not available")
  }, [passengerLat, passengerLng, loading])

  const [canDepart, setCanDepart] = useState(!departureTimeRaw)
  const [departLabel, setDepartLabel] = useState(departureTime || "Now")

  useEffect(() => {
    if (!departureTimeRaw) { setCanDepart(true); return }
    const check = () => {
      const parts = String(departureTimeRaw).split(":")
      if (parts.length < 2) { setCanDepart(true); return }
      const [h, m] = parts.map(Number)
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
      navigate(`/ride-pickup/${rideId}`, {
        replace: true,
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

  if (loading && !rideData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white gap-4">
        <div className="w-10 h-10 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-500 font-medium anim-pulse">Syncing ride details…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <div style={{ height: "52vh", width: "100%", flexShrink: 0 }}>
        {center && (
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
        )}
      </div>

      <div
        className="flex-1 bg-white px-5 pt-5 pb-8 flex flex-col gap-6"
        style={{
          borderRadius: "32px 32px 0 0",
          marginTop: -30,
          boxShadow: "0 -8px 30px rgba(0,0,0,0.1)",
          position: "relative",
          zIndex: 10
        }}
      >
        <div className="flex justify-center">
          <div className="w-12 h-1.5 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold text-green-700 uppercase tracking-[0.2em] mb-1">
              Ride Confirmed
            </p>
          </div>
        </div>

        <div className="bg-blue-50/50 rounded-3xl p-5 border border-blue-100 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl shadow-lg border-2 border-white">
              👤
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 leading-tight">{passengerName}</h3>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Verified Passenger</p>
            </div>
            {passengerPhone && (
              <a
                href={`tel:${passengerPhone}`}
                className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-md border border-blue-50 active:scale-90 transition-transform"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </a>
            )}
          </div>

          <div className="flex flex-col gap-y-5 pt-2">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] block">
                Pickup Location
              </span>
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                <p className="text-sm font-semibold text-gray-700 leading-snug">
                  {passengerAddress}
                </p>
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] block">
                Distance
              </span>
              <p className="text-base font-semibold text-gray-700">
                {Number(distanceKm).toFixed(1)} km
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] block">
                Departure
              </span>
              <p className="text-base font-semibold text-orange-600 uppercase">
                {departLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-700 rounded-2xl py-4 flex flex-col items-center justify-center">
          <p className="text-[13px] text-emerald-100 font-semibold uppercase tracking-wide mb-1">
            ESTIMATED EARNINGS
          </p>
          <p className="text-3xl font-bold text-white">
            ₹{fare}
          </p>
        </div>

        <div className="mt-auto pt-4 pb-2">
          {error && (
            <div className="mb-4 bg-red-50 p-3 rounded-2xl border border-red-100 flex items-center gap-3">
              <span className="text-red-500 text-lg">⚠</span>
              <p className="text-red-600 text-xs font-bold uppercase tracking-wide">{error}</p>
            </div>
          )}

          {canDepart ? (
            <SwipeButton
              label="Slide to Go Pick Up Passenger"
              color="#16a34a"
              disabled={loading}
              onSwipeComplete={handleGoPickUp}
            />
          ) : (
            <div className="w-full py-5 rounded-3xl bg-gray-100 text-center text-gray-500 font-black text-sm uppercase tracking-widest border-2 border-dashed border-gray-200">
              Wait until {departLabel}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

function BottomNav() {
  const navigate = useNavigate();
  const tabs = [
    { id: "home", icon: Compass, label: "Explore" },
    { id: "history", icon: Clock, label: "History" },
    { id: "account", icon: User, label: "Profile" }
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-2 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => navigate("/rider-home", { state: { tab: t.id } })} className="flex flex-col items-center gap-1.5 flex-1 relative group">
            <Icon className="w-6 h-6 transition-colors duration-300 text-gray-400 group-hover:text-gray-600" />
            <span className={`text-[10px] uppercase tracking-wider font-semibold transition-colors text-gray-400 group-hover:text-gray-600`}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
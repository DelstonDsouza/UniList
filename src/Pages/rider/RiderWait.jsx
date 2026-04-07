// src/pages/rider/RiderWait.jsx

import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { socket, connectSocket, disconnectSocket } from "../../services/socket"
import { apiFetch } from "../../services/api"
import { Compass, Clock, User } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const pickupIcon = new L.DivIcon({
  html: `<div style="background-color: #0f766e; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
  className: "", iconSize: [22, 22], iconAnchor: [11, 11]
})

const collegeIcon = new L.DivIcon({
  html: `<div style="background-color: #ef4444; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.3);"><div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div></div>`,
  className: "", iconSize: [26, 26], iconAnchor: [13, 13]
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
  return <Polyline positions={coords} pathOptions={{ color: "#0d9488", weight: 5, opacity: 0.8 }} />
}

// \u2500\u2500 Reverse geocode \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { "User-Agent": "RideMateApp/1.0", "Accept-Language": "en" } }
    )
    const data = await res.json()
    const a = data?.address || {}
    const road = a.road || a.pedestrian || a.footway || ""
    const area = a.neighbourhood || a.suburb || a.village || a.hamlet || ""
    const city = a.city || a.town || a.city_district || a.county || ""
    const parts = [road, area, city].filter(Boolean)
    if (parts.length >= 2) return parts.join(", ")
    if (parts.length === 1) return parts[0]
    return data?.display_name?.split(",").slice(0, 3).join(", ").trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}


export default function RiderWait() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const { userLocation, collegeLocation, departureTime, departureTimeRaw } = location.state || {}


  const [dots, setDots] = useState("")
  const [passengerJoined, setPassengerJoined] = useState(false)
  const [showCancelPopup, setShowCancelPopup] = useState(false)
  const [showNoPassenger, setShowNoPassenger] = useState(false)

  // Location names
  const [pickupName, setPickupName] = useState("Getting location…")
  const [destinationName] = useState("St Aloysius College, Mangalore")


  const navigatedRef = useRef(false)
  const watchIdRef = useRef(null)
  const locationEmitRef = useRef(null)

  // Reverse-geocode pickup
  useEffect(() => {
    if (!userLocation) return
    reverseGeocode(userLocation[0], userLocation[1]).then(setPickupName)
  }, [userLocation])

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 500)
    return () => clearInterval(t)
  }, [])

  // \u2500\u2500 Prevent Back Navigation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  useEffect(() => {
    window.history.pushState(null, "", window.location.href)
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Departure time countdown
  useEffect(() => {
    if (!departureTime && !departureTimeRaw) return
    const raw = departureTimeRaw || departureTime
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
      if (diff <= 0 && !passengerJoined && !navigatedRef.current) setShowNoPassenger(true)
    }
    const timer = setInterval(tick, 1000)
    tick()
    return () => clearInterval(timer)
  }, [departureTime, departureTimeRaw, passengerJoined])

  // Socket
  useEffect(() => {
    if (!id) return
    connectSocket()
    socket.emit("join:ride", id)

    const handleLocked = (data) => {
      if (navigatedRef.current) return
      navigatedRef.current = true
      setPassengerJoined(true)
      setTimeout(() => {
        navigate(`/ride-confirmed/${data.rideId}`, {
          replace: true,
          state: {
            rideId: data.rideId,
            userLocation, collegeLocation,
            departureTime, departureTimeRaw,
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

  // GPS location emitter
  useEffect(() => {
    if (!id || !navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(() => { }, () => { }, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 3000,
    })
    locationEmitRef.current = setInterval(() => {
      if (!socket.connected) return
      const emitLocation = (pos) => socket.emit("rider:location", {
          rideId: id, lat: pos.coords.latitude, lng: pos.coords.longitude,
      })
      navigator.geolocation.getCurrentPosition(
        emitLocation,
        () => {
           // Fallback to low accuracy
           navigator.geolocation.getCurrentPosition(emitLocation, () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: Infinity })
        },
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
    <div className="fixed inset-0 bg-white overflow-hidden pb-20">


      {/* NO PASSENGERS POPUP */}
      {showNoPassenger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center w-[88%] max-w-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Passengers Found</h2>
            <p className="text-gray-500 text-sm mb-6">Departure time expired and no one joined.</p>
            <button
              onClick={async () => {
                try { await apiFetch(`/rides/${id}/cancel`, { method: "POST" }) } catch { }
                clearInterval(locationEmitRef.current)
                navigator.geolocation.clearWatch(watchIdRef.current)
                disconnectSocket(true)
                navigate("/rider-home", { replace: true })
              }}
              className="w-full py-3 rounded-2xl bg-gray-900 text-white font-semibold text-base hover:bg-gray-700 transition"
            >Close</button>
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
                  try { await apiFetch(`/rides/${id}/cancel`, { method: "POST" }) } catch (err) {
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
        </div>
      </div>

      {/* MAP */}
      <div className="absolute top-0 left-0 right-0 h-[55vh] z-0">
        <MapContainer center={pickupCoords} zoom={13} zoomControl={false}
          style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxZoom={20}
          />
          <Marker position={pickupCoords} icon={pickupIcon} />
          <Marker position={collegeCoords} icon={collegeIcon} />
          <RoutePolyline from={pickupCoords} to={collegeCoords} />
        </MapContainer>
      </div>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="bg-white rounded-t-[32px] p-6 border-t border-gray-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] space-y-5 pb-28">

          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Trip</p>
          </div>

          {/* Route info \u2014 pickup, destination, departs all on left */}
          <div className="flex gap-3 items-start">
            <div className="flex flex-col items-center gap-1 mt-2">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-600 flex-shrink-0" />
              <div className="w-px flex-1 bg-gray-300 min-h-[40px]" />
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 flex-shrink-0" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Pickup</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug">{pickupName}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Destination</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug">{destinationName}</p>
              </div>
              {departureTime && (
                <div className="flex gap-2 items-start ml-[-24px]">
                  <div className="mt-1">
                    <Clock className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                      Departs
                    </p>
                    <p className="text-sm font-bold text-gray-800">
                      {departureTime}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Passenger status */}
          <div className="pt-3 border-t border-gray-100">
            {!passengerJoined ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">No passengers yet</p>
                  <p className="text-xs text-gray-400">Searching nearby students{dots}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold text-green-600 animate-pulse">
                ✓ Passenger found — redirecting…
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={() => setShowCancelPopup(true)}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-red-500 font-semibold text-sm">
              Cancel Ride
            </button>
            <button disabled
              className="flex-1 py-3 rounded-xl bg-blue-400/40 text-blue-700 font-semibold text-sm cursor-not-allowed">
              {passengerJoined ? "Confirmed!" : "Waiting"}
            </button>
          </div>
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
        const active = t.id === "home";
        return (
          <button
            key={t.id}
            onClick={() => {
              if (t.id === "home") return;
              navigate("/rider-home", { state: { tab: t.id } });
            }}
            className="flex flex-col items-center gap-1.5 flex-1 relative group"
          >
            <Icon className={`w-6 h-6 transition-colors duration-300 ${active ? "text-teal-600" : "text-gray-400 group-hover:text-gray-600"}`} />
            <span className={`text-[10px] uppercase tracking-wider font-semibold transition-colors ${active ? "text-teal-600" : "text-gray-400 group-hover:text-gray-600"}`}>{t.label}</span>
            {active && <motion.div layoutId="nav-pill" className="absolute -bottom-2 w-1.5 h-1.5 bg-teal-500 rounded-full" />}
          </button>
        )
      })}
    </div>
  );
}
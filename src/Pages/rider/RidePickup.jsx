// src/pages/rider/RidePickup.jsx
//
// Page flow:  RideConfirmed → [RidePickup] → RiderOngoing
//
// Shows:
//  • Live map: rider GPS → passenger pickup (route updates as rider moves)
//  • Passenger name + pickup location (no fare/departs — those are on RideConfirmed)
//  • 4-box OTP at bottom, locked until rider arrives within 80m

import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useLocation, useNavigate } from "react-router-dom"
import { useRide } from "../../context/RideContext"
import { apiFetch } from "../../services/api"

// ─── Fix Leaflet marker icons (Vite) ─────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ─── Custom pin ───────────────────────────────────────────────────────────────
function PinLayer({ position, color, emoji, label }) {
  const map = useMap()
  useEffect(() => {
    if (!position) return
    const icon = L.divIcon({
      className: "",
      html: `<div style="
        background:${color};width:40px;height:40px;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        border:3px solid white;box-shadow:0 3px 14px rgba(0,0,0,0.28);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:16px;line-height:1">${emoji}</span>
      </div>`,
      iconSize:   [40, 40],
      iconAnchor: [20, 40],
    })
    const m = L.marker(position, { icon }).addTo(map)
    if (label) m.bindTooltip(label, { permanent: false, direction: "top", offset: [0, -42] })
    return () => { try { m.remove() } catch {} }
  }, [position?.[0], position?.[1], map]) // eslint-disable-line
  return null
}

// ─── Accuracy ring around rider ───────────────────────────────────────────────
function AccuracyRing({ position }) {
  const map = useMap()
  useEffect(() => {
    if (!position) return
    const c = L.circle(position, {
      radius: 50, color: "#2563EB", fillColor: "#2563EB",
      fillOpacity: 0.10, weight: 1.5, dashArray: "5 5",
    }).addTo(map)
    return () => { try { c.remove() } catch {} }
  }, [position?.[0], position?.[1], map]) // eslint-disable-line
  return null
}

// ─── Auto-fit map to route ────────────────────────────────────────────────────
function FitRoute({ coords }) {
  const map  = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!coords || coords.length < 2) return
    const key = `${coords[0]}-${coords[coords.length - 1]}`
    if (prev.current === key) return
    prev.current = key
    try { map.fitBounds(L.latLngBounds(coords), { padding: [56, 56], animate: true, duration: 1.0 }) } catch {}
  }, [coords, map])
  return null
}

// ─── Haversine distance in metres ────────────────────────────────────────────
const haversineM = ([lat1, lng1], [lat2, lng2]) => {
  const R  = 6371000
  const dL = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dl / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── OSRM route fetch ─────────────────────────────────────────────────────────
const getRoute = async (from, to, signal) => {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}` +
      `?overview=full&geometries=geojson`
    const res   = await fetch(url, { signal })
    const data  = await res.json()
    const route = data?.routes?.[0]
    if (!route) return null
    return {
      coords:  (route.geometry.coordinates || []).map(([lng, lat]) => [lat, lng]),
      km:      parseFloat((route.distance / 1000).toFixed(1)),
      etaMin:  Math.ceil(route.duration / 60),
    }
  } catch (e) {
    if (e.name !== "AbortError") console.warn("OSRM:", e.message)
    return null
  }
}

// ─── 4-box OTP input ──────────────────────────────────────────────────────────
function OtpBoxes({ value, onChange, disabled }) {
  const refs = useRef([])

  const handleChange = (i, char) => {
    const digit = char.replace(/\D/, "")
    if (!digit) return
    const arr = value.split("")
    arr[i]    = digit
    onChange(arr.join("").slice(0, 4))
    if (i < 3) refs.current[i + 1]?.focus()
  }
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (value[i]) {
        const arr = value.split(""); arr[i] = ""; onChange(arr.join(""))
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
      }
    }
  }
  const handlePaste = (e) => {
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4)
    if (p) { onChange(p); refs.current[Math.min(p.length, 3)]?.focus() }
    e.preventDefault()
  }

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center" }} onPaste={handlePaste}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          style={{
            width: 60, height: 68,
            fontSize: 30, fontWeight: 800, textAlign: "center",
            borderRadius: 16,
            border: disabled
              ? "2px solid #e2e8f0"
              : value[i] ? "2.5px solid #16a34a" : "2.5px solid #2563EB",
            background: disabled
              ? "#f8fafc"
              : value[i] ? "#f0fdf4" : "#eff6ff",
            color:    disabled ? "#cbd5e1" : "#0f172a",
            outline:  "none",
            transition: "border 0.2s, background 0.2s",
            boxShadow:  disabled ? "none" : "0 2px 10px rgba(37,99,235,0.12)",
            cursor:     disabled ? "not-allowed" : "text",
          }}
        />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RidePickup() {
  const { state }          = useLocation()
  const navigate            = useNavigate()
  const { ride, setRide }  = useRide()

  const {
    userLocation,
    collegeLocation,
    passengerPickup   = null,
    passengerName     = "Passenger",
    passengerRating   = 4.8,
    passengerLocation = "Pickup point",
    distance          = "",
    fare              = 20,
    departureTime     = "",
  } = state || {}

  // ── Rider live GPS ─────────────────────────────────────────────────────────
  const [riderPos,    setRiderPos]    = useState(userLocation ?? null)
  const watchRef                      = useRef(null)

  // ── Route state ────────────────────────────────────────────────────────────
  const [routeCoords, setRouteCoords] = useState([])
  const [routeKm,     setRouteKm]     = useState(null)
  const [routeEta,    setRouteEta]    = useState(null)
  const abortRef                      = useRef(null)

  // ── Arrived (unlocks OTP) ──────────────────────────────────────────────────
  const [arrived,    setArrived]    = useState(false)

  // ── OTP ───────────────────────────────────────────────────────────────────
  const [otp,        setOtp]        = useState("")
  const [otpError,   setOtpError]   = useState("")
  const [submitting, setSubmitting] = useState(false)

  // ── Start GPS watch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setRiderPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
    )
    return () => { try { navigator.geolocation.clearWatch(watchRef.current) } catch {} }
  }, [])

  // ── Fetch route as rider moves ─────────────────────────────────────────────
  useEffect(() => {
    if (!riderPos || !passengerPickup) return

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    getRoute(riderPos, passengerPickup, ctrl.signal).then((r) => {
      if (!r) return
      setRouteCoords(r.coords)
      setRouteKm(r.km)
      setRouteEta(r.etaMin)
      // Auto-unlock when within 80 metres
      if (haversineM(riderPos, passengerPickup) <= 80) setArrived(true)
    })

    return () => ctrl.abort()
  }, [riderPos?.[0], riderPos?.[1]]) // eslint-disable-line

  // ── OTP verify ─────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (otp.length < 4) { setOtpError("Enter all 4 digits"); return }
    setSubmitting(true)
    setOtpError("")
    try {
      await apiFetch("/rides/verify-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rideId: ride.rideId, otp }),
      })
      setRide((prev) => ({ ...prev, status: "ongoing" }))
      navigate("/rider-ongoing", { state })
    } catch (e) {
      setOtpError(e?.message || "Wrong OTP. Please try again.")
      setOtp("")
    } finally {
      setSubmitting(false)
    }
  }

  const mapCenter = riderPos ?? passengerPickup ?? collegeLocation ?? [12.9141, 74.856]

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f1f5f9" }}>

      {/* ══ MAP ════════════════════════════════════════════════════════════ */}
      <div style={{ height: "50vh", width: "100%", flexShrink: 0, position: "relative" }}>
        <MapContainer
          center={mapCenter}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />

          {routeCoords.length > 1 && (
            <Polyline positions={routeCoords} pathOptions={{ color: "#2563EB", weight: 5, opacity: 0.88 }} />
          )}
          {routeCoords.length > 1 && <FitRoute coords={routeCoords} />}

          {riderPos && (
            <>
              <PinLayer position={riderPos}       color="#2563EB" emoji="🏍" label="You" />
              <AccuracyRing position={riderPos} />
            </>
          )}
          {passengerPickup && (
            <PinLayer position={passengerPickup}  color="#16a34a" emoji="👤" label={passengerName} />
          )}
        </MapContainer>

        {/* Status badge — top left */}
        <div style={{
          position: "absolute", top: 14, left: 14, zIndex: 500,
          background: arrived ? "#16a34a" : "#2563EB",
          color: "white", borderRadius: 999,
          padding: "7px 16px", fontSize: 12, fontWeight: 700,
          letterSpacing: "0.06em", boxShadow: "0 2px 12px rgba(0,0,0,0.20)",
          transition: "background 0.4s",
        }}>
          {arrived ? "✓ AT PICKUP" : "🏍 EN ROUTE"}
        </div>

        {/* ETA badge — top right */}
        <div style={{
          position: "absolute", top: 14, right: 14, zIndex: 500,
          background: "white", borderRadius: 999,
          padding: "7px 14px", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
        }}>
          <span style={{ color: arrived ? "#16a34a" : "#2563EB" }}>
            {arrived ? "Arrived" : routeEta != null ? `${routeEta} min` : "…"}
          </span>
          <span style={{ color: "#e2e8f0" }}>|</span>
          <span style={{ color: "#475569" }}>
            {routeKm != null ? `${routeKm} km` : "…"}
          </span>
        </div>
      </div>

      {/* ══ BOTTOM SHEET ═══════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        background: "white",
        borderRadius: "24px 24px 0 0",
        marginTop: -20,
        zIndex: 10,
        position: "relative",
        padding: "18px 20px 32px",
        boxShadow: "0 -6px 30px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflowY: "auto",
      }}>

        {/* Handle */}
        <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 99, margin: "0 auto 2px" }} />

        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", letterSpacing: "0.10em", margin: "0 0 3px" }}>
              PASSENGER FOUND
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Head to Pickup Point
            </h2>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: "#eff6ff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>
            🏍
          </div>
        </div>

        {/* Passenger card — name + pickup location only, no fare/departs */}
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BFDBFE", borderRadius: 18, padding: "14px 16px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.10em", margin: "0 0 10px" }}>
            PASSENGER DETAILS
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 20, fontWeight: 800,
              }}>
                {passengerName.charAt(0)}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: "0 0 3px" }}>
                  {passengerName}
                </p>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  📍 {passengerLocation}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#fbbf24", fontSize: 18 }}>★</span>
              <span style={{ fontWeight: 700, color: "#374151", fontSize: 14 }}>{passengerRating}</span>
            </div>
          </div>
        </div>

        {/* ══ OTP SECTION ════════════════════════════════════════════════════ */}
        <div style={{
          background: arrived ? "#f0fdf4" : "#f8fafc",
          border: `2px solid ${arrived ? "#86efac" : "#e2e8f0"}`,
          borderRadius: 20,
          padding: "18px 16px 20px",
          transition: "border 0.4s, background 0.4s",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: arrived ? "#16a34a" : "#e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, transition: "background 0.4s",
            }}>
              🔐
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 2px", color: arrived ? "#15803d" : "#64748b" }}>
                {arrived ? "Enter passenger's OTP" : "OTP unlocks on arrival"}
              </p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                {arrived ? "Ask passenger for their 4-digit code" : "Drive to pickup point to unlock"}
              </p>
            </div>
          </div>

          {/* 4 OTP boxes */}
          <OtpBoxes
            value={otp}
            onChange={(v) => { setOtp(v); setOtpError("") }}
            disabled={!arrived || submitting}
          />

          {otpError && (
            <p style={{ textAlign: "center", color: "#dc2626", fontSize: 12, marginTop: 10, fontWeight: 600 }}>
              ⚠ {otpError}
            </p>
          )}

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={!arrived || otp.length < 4 || submitting}
            style={{
              width: "100%", marginTop: 16, padding: "15px 0",
              borderRadius: 14, border: "none",
              fontSize: 15, fontWeight: 700, letterSpacing: "0.02em",
              cursor: (!arrived || otp.length < 4 || submitting) ? "not-allowed" : "pointer",
              background: (!arrived || otp.length < 4)
                ? "#e2e8f0"
                : "linear-gradient(135deg,#16a34a,#15803d)",
              color:     (!arrived || otp.length < 4) ? "#94a3b8" : "white",
              boxShadow: (arrived && otp.length === 4) ? "0 4px 18px rgba(22,163,74,0.28)" : "none",
              transition: "all 0.3s",
            }}
          >
            {submitting
              ? "Verifying…"
              : !arrived
                ? "Drive to passenger first"
                : otp.length < 4
                  ? "Enter OTP to continue"
                  : "Verify OTP & Start Ride →"}
          </button>

          {/* Manual override */}
          {!arrived && (
            <button
              onClick={() => setArrived(true)}
              style={{
                width: "100%", marginTop: 10, padding: "11px 0",
                borderRadius: 12, border: "1.5px solid #cbd5e1",
                background: "transparent", color: "#64748b",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              I've reached the pickup point
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
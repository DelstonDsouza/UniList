// src/pages/rider/RidePickup.jsx
import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useLocation, useNavigate } from "react-router-dom"
import { apiFetch } from "../../services/api"
import { socket, connectSocket } from "../../services/socket"
import toast from "react-hot-toast"
import SwipeButton from "../../components/ui/SwipeButton"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const COLLEGE = [12.872109642876621, 74.84534749009204]
const AVG_SPEED_KMH = 40
const PEAK_MULTIPLIER = 1.5
const PEAK_START = 8
const PEAK_END = 9

function isPeakHour() {
  const h = new Date().getHours()
  return h >= PEAK_START && h < PEAK_END
}

function calcEta(fromLat, fromLng, toLat, toLng) {
  const R = 6371
  const dLat = ((toLat - fromLat) * Math.PI) / 180
  const dLng = ((toLng - fromLng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((fromLat * Math.PI) / 180) *
    Math.cos((toLat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const speed = isPeakHour() ? AVG_SPEED_KMH / PEAK_MULTIPLIER : AVG_SPEED_KMH
  return { distKm: Number(distKm.toFixed(1)), etaMin: Math.max(1, Math.round((distKm / speed) * 60)) }
}

const haversineM = ([lat1, lng1], [lat2, lng2]) => {
  const R = 6371000
  const dL = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dl / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Map components ────────────────────────────────────────────────────────────
function PinLayer({ position, color, emoji, label }) {
  const map = useMap()
  useEffect(() => {
    if (!position) return
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:${color};width:40px;height:40px;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        border:3px solid white;box-shadow:0 3px 14px rgba(0,0,0,0.28);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:16px;line-height:1">${emoji}</span></div>`,
      iconSize: [40, 40], iconAnchor: [20, 40],
    })
    const m = L.marker(position, { icon }).addTo(map)
    if (label) m.bindTooltip(label, {
      permanent: true, direction: "top", offset: [0, -44],
      className: "leaflet-tooltip-custom"
    })
    return () => { try { m.remove() } catch { } }
  }, [position?.[0], position?.[1], map]) // eslint-disable-line
  return null
}

function AccuracyRing({ position }) {
  const map = useMap()
  useEffect(() => {
    if (!position) return
    const c = L.circle(position, {
      radius: 50, color: "#2563EB", fillColor: "#2563EB",
      fillOpacity: 0.10, weight: 1.5, dashArray: "5 5",
    }).addTo(map)
    return () => { try { c.remove() } catch { } }
  }, [position?.[0], position?.[1], map]) // eslint-disable-line
  return null
}

function FitRoute({ coords }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!coords || coords.length < 2) return
    const key = `${coords[0]}-${coords[coords.length - 1]}`
    if (prev.current === key) return
    prev.current = key
    try { map.fitBounds(L.latLngBounds(coords), { padding: [56, 56], animate: true, duration: 1.0 }) } catch { }
  }, [coords, map])
  return null
}

const getOsrmRoute = async (from, to, signal) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal })
    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route) return null
    return {
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      durationMin: Math.round(route.duration / 60),
      distKm: Number((route.distance / 1000).toFixed(1)),
    }
  } catch (e) {
    if (e.name !== "AbortError") console.warn("OSRM:", e.message)
    return null
  }
}

// ── OTP input boxes ───────────────────────────────────────────────────────────
function OtpBoxes({ value, onChange, disabled }) {
  const refs = useRef([])
  const handleChange = (i, char) => {
    const digit = char.replace(/\D/, "")
    if (!digit) return
    const arr = value.split(""); arr[i] = digit
    onChange(arr.join("").slice(0, 4))
    if (i < 3) refs.current[i + 1]?.focus()
  }
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (value[i]) { const arr = value.split(""); arr[i] = ""; onChange(arr.join("")) }
      else if (i > 0) refs.current[i - 1]?.focus()
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
        <input key={i} ref={el => refs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={value[i] || ""} disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          style={{
            width: 60, height: 68, fontSize: 30, fontWeight: 800, textAlign: "center",
            borderRadius: 16,
            border: disabled ? "2px solid #e2e8f0" : value[i] ? "2.5px solid #16a34a" : "2.5px solid #2563EB",
            background: disabled ? "#f8fafc" : value[i] ? "#f0fdf4" : "#eff6ff",
            color: disabled ? "#cbd5e1" : "#0f172a", outline: "none",
            boxShadow: disabled ? "none" : "0 2px 10px rgba(37,99,235,0.12)",
            cursor: disabled ? "not-allowed" : "text",
          }}
        />
      ))}
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        width: "100%", maxWidth: 480, background: "white",
        borderRadius: "24px 24px 0 0", padding: "24px 20px 36px",
        maxHeight: "80vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ReportModal({ onClose, rideId }) {
  const reasons = [
    "Passenger was rude or unprofessional",
    "Passenger gave wrong location",
    "Passenger did not show up",
    "Passenger asked for detour",
    "Safety concern",
    "Other issue",
  ]
  const [selected, setSelected] = useState("")
  const [details, setDetails] = useState("")
  const [sent, setSent] = useState(false)

  const submit = () => {
    if (!selected) return
    setSent(true)
  }

  if (sent) return (
    <Modal title="Report Submitted" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <p style={{ fontSize: 15, color: "#475569" }}>Thank you. We'll review your report within 24 hours.</p>
        <button onClick={onClose} style={{
          marginTop: 20, width: "100%", padding: "14px 0", borderRadius: 14,
          background: "#0f172a", color: "white", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
        }}>Close</button>
      </div>
    </Modal>
  )

  return (
    <Modal title="🚨 Report an Issue" onClose={onClose}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>What happened?</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {reasons.map(r => (
          <button key={r} onClick={() => setSelected(r)} style={{
            padding: "12px 14px", borderRadius: 12, textAlign: "left", cursor: "pointer",
            fontSize: 14, fontWeight: selected === r ? 700 : 500,
            background: selected === r ? "#0f172a" : "#f8fafc",
            color: selected === r ? "white" : "#374151",
            border: selected === r ? "2px solid #0f172a" : "2px solid #e2e8f0",
          }}>{r}</button>
        ))}
      </div>
      <textarea value={details} onChange={e => setDetails(e.target.value)}
        placeholder="Additional details (optional)…" rows={3}
        style={{
          width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 13,
          border: "1.5px solid #e2e8f0", resize: "none", outline: "none",
          fontFamily: "inherit", boxSizing: "border-box",
        }}
      />
      <button onClick={submit} disabled={!selected} style={{
        marginTop: 14, width: "100%", padding: "14px 0", borderRadius: 14,
        background: selected ? "#dc2626" : "#e2e8f0",
        color: selected ? "white" : "#94a3b8",
        fontWeight: 700, fontSize: 15, border: "none",
        cursor: selected ? "pointer" : "not-allowed",
      }}>Submit Report</button>
    </Modal>
  )
}

function HelpModal({ onClose }) {
  const faqs = [
    { q: "How does OTP verification work?", a: "When you arrive at the pickup point, ask the passenger for their 4-digit OTP. Enter it to start the ride." },
    { q: "What if the OTP is wrong?", a: "Ask the passenger to recheck. If issues persist, call them using the phone number shown." },
    { q: "When does the ride start?", a: "The ride officially starts after OTP verification. Navigation then switches to College destination." },
    { q: "How is fare calculated?", a: "₹5/km from passenger location to St Aloysius College. Minimum fare ₹20." },
    { q: "ETA seems too high — why?", a: "Between 8–9 AM peak hours, we apply 1.5× traffic multiplier for realistic estimates." },
    { q: "What if I have a breakdown?", a: "Call the passenger to inform them, then report the issue using the Report button." },
  ]
  return (
    <Modal title="❓ Help & FAQ" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {faqs.map(({ q, a }) => (
          <div key={q} style={{ background: "#f8fafc", borderRadius: 14, padding: "14px 16px" }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", margin: "0 0 6px" }}>{q}</p>
            <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.5 }}>{a}</p>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RidePickup() {
  const { state } = useLocation()
  const navigate = useNavigate()

  const {
    rideId, userLocation, collegeLocation,
    passengerPickup, passengerName = "Passenger",
    passengerPhone = "", fare = 20, departureTime = "",
  } = state || {}

  const [riderPos, setRiderPos] = useState(userLocation ?? null)
  const [routeCoords, setRouteCoords] = useState([])
  const [arrived, setArrived] = useState(false)
  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState("toPassenger") // "toPassenger" | "toCollege"
  const [etaToPass, setEtaToPass] = useState(null)
  const [etaToCol, setEtaToCol] = useState(null)
  const [distToCol, setDistToCol] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  // ── Endgame flow ──────────────────────────────────────────────────────────
  const [reachLoading, setReachLoading] = useState(false)

  const watchRef = useRef(null)
  const abortRef = useRef(null)
  const isPeak = isPeakHour()

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return
    connectSocket()
    socket.emit("join:ride", rideId)
  }, [rideId])

  // ── GPS watch + socket emit ───────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation || !rideId) return
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setRiderPos([lat, lng])
        socket.emit("rider:location", { rideId, lat, lng })
      },
      () => { },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
    return () => { try { navigator.geolocation.clearWatch(watchRef.current) } catch { } }
  }, [rideId])

  // \u2500\u2500 OSRM route + ETA (single source of truth \u2014 matches passenger ActiveRidePanel) \u2500\u2500
  useEffect(() => {
    if (!riderPos) return
    const dest = phase === "toCollege"
      ? (collegeLocation || COLLEGE)
      : passengerPickup
    if (!dest) return

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    getOsrmRoute(riderPos, dest, ctrl.signal).then(r => {
      if (!r) return
      setRouteCoords(r.coords)
      // Use OSRM road distance/duration — same as passenger's view
      if (phase === "toPassenger") {
        setEtaToPass(r.durationMin)
        if (haversineM(riderPos, passengerPickup) <= 80) setArrived(true)
      } else {
        setEtaToCol(r.durationMin)
        setDistToCol(r.distKm)
      }
    })
    return () => ctrl.abort()
  }, [riderPos?.[0], riderPos?.[1], phase]) // eslint-disable-line


  // ── OTP verify ────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (otp.length < 4) { setOtpError("Enter all 4 digits"); return }
    setSubmitting(true); setOtpError("")
    try {
      await apiFetch(`/rides/${rideId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      })
      // Switch to college navigation phase
      setPhase("toCollege")
      setRouteCoords([])
    } catch (e) {
      setOtpError(e?.message || "Wrong OTP. Please try again.")
      setOtp("")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reached Destination — navigate to full rider payment page ──────────────
  const handleReached = async () => {
    setReachLoading(true)
    try {
      const data = await apiFetch(`/rides/${rideId}/reached`, { method: "POST" })
      // Use server-calculated distanceKm (passenger pickup → college) from fare
      const serverDistKm = data?.data?.distanceKm ?? distToCol
      const serverFare = data?.data?.fare ?? fare
      navigate("/rider-payment", {
        replace: true,
        state: { rideId, distanceKm: serverDistKm, fare: serverFare, passengerName },
      })
    } catch (e) {
      toast.error(e?.message || "Could not mark as reached. Try again.")
    } finally {
      setReachLoading(false)
    }
  }

  const mapCenter = riderPos ?? passengerPickup ?? COLLEGE
  const currentEta = phase === "toCollege" ? etaToCol : etaToPass
  const etaLabel = phase === "toCollege" ? "Reaching college in" : "ETA to Passenger"
  const routeColor = phase === "toCollege" ? "#16a34a" : "#2563EB"
  const destPin = phase === "toCollege" ? (collegeLocation || COLLEGE) : passengerPickup

  return (
    <>
      {showReport && <ReportModal onClose={() => setShowReport(false)} rideId={rideId} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f1f5f9" }}>

        {/* MAP */}
        <div style={{ height: "48vh", width: "100%", flexShrink: 0, position: "relative" }}>
          <MapContainer center={mapCenter} zoom={14}
            style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer
              url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap contributors"
              maxZoom={20}
            />
            {routeCoords.length > 1 && (
              <Polyline positions={routeCoords}
                pathOptions={{ color: routeColor, weight: 5, opacity: 0.88 }} />
            )}
            {routeCoords.length > 1 && <FitRoute coords={routeCoords} />}
            {riderPos && (
              <>
                <PinLayer position={riderPos} color="#2563EB" emoji="🏍" label="You" />
                <AccuracyRing position={riderPos} />
              </>
            )}
            {destPin && (
              <PinLayer
                position={destPin}
                color={phase === "toCollege" ? "#dc2626" : "#16a34a"}
                emoji={phase === "toCollege" ? "🎓" : "👤"}
                label={phase === "toCollege" ? "College" : passengerName}
              />
            )}
          </MapContainer>

          {/* Status badge */}

          {/* Help + Report overlay */}
          <div style={{ position: "absolute", top: 14, right: 14, zIndex: 500, display: "flex", gap: 8 }}>
            <button onClick={() => setShowHelp(true)} style={{
              padding: "7px 12px", borderRadius: 20, border: "none",
              background: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#475569",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}>❓</button>
            <button onClick={() => setShowReport(true)} style={{
              padding: "7px 12px", borderRadius: 20, border: "none",
              background: "#fef2f2", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#dc2626",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}>🚨</button>
          </div>
        </div>

        {/* BOTTOM SHEET */}
        <div style={{
          flex: 1, background: "white", borderRadius: "24px 24px 0 0",
          marginTop: -20, zIndex: 10, position: "relative",
          padding: "16px 20px 32px",
          boxShadow: "0 -6px 30px rgba(0,0,0,0.10)",
          display: "flex", flexDirection: "column", gap: 12, overflowY: "auto",
        }}>
          <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 99, margin: "0 auto 4px" }} />

          {/* Title */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", margin: "0 0 2px",
                color: phase === "toCollege" ? "#16a34a" : "#2563EB"
              }}>
                {phase === "toCollege" ? "RIDE IN PROGRESS" : "Pickup Passenger"}
              </p>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                {phase === "toCollege" ? "Heading to College" : arrived ? "Enter Passenger OTP" : "Head to Pickup Point"}
              </h2>
            </div>
          </div>

          {/* ── BIG ETA ─────────────────────────────────────────────────── */}
          <div style={{
            background: phase === "toCollege" ? "#0f172a" : "#1e40af",
            borderRadius: 18, padding: "16px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <p style={{
                fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600,
                letterSpacing: "0.08em", margin: "0 0 2px"
              }}>{etaLabel.toUpperCase()}</p>
              <p style={{ fontSize: 48, fontWeight: 900, color: "white", margin: 0, lineHeight: 1 }}>
                {currentEta != null ? currentEta : "—"}
                <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 6, color: "rgba(255,255,255,0.6)" }}>
                  {currentEta != null ? "min" : ""}
                </span>
              </p>
              {isPeak && (
                <p style={{ fontSize: 10, color: "#fbbf24", marginTop: 3, fontWeight: 600 }}>
                  ⚠ Peak hour — 1.5× traffic
                </p>
              )}
            </div>
            {phase === "toCollege" && distToCol != null && (
              <p style={{ fontSize: 26, fontWeight: 800, color: "white", margin: 0 }}>
                {distToCol} km
              </p>
            )}
          </div>

          {/* Passenger card */}
          <div style={{ background: "#F0F9FF", border: "1.5px solid #BFDBFE", borderRadius: 16, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 18, fontWeight: 800,
                }}>{passengerName.charAt(0)}</div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: "0 0 2px" }}>{passengerName}</p>
                  {passengerPhone && (
                    <a href={`tel:${passengerPhone}`}
                      style={{ fontSize: 12, color: "#2563EB", textDecoration: "none" }}>
                      📞 {passengerPhone}
                    </a>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#16a34a", margin: 0 }}>₹{fare}</p>
                <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>cash</p>
              </div>
            </div>
          </div>

          {/* OTP section — only before ride starts */}
          {phase === "toPassenger" && (
            <div style={{
              background: arrived ? "#f0fdf4" : "#f8fafc",
              border: `2px solid ${arrived ? "#86efac" : "#e2e8f0"}`,
              borderRadius: 18, padding: "16px 16px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: arrived ? "#16a34a" : "#e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>🔐</div>
                <div>
                  <p style={{
                    fontWeight: 700, fontSize: 14, margin: "0 0 1px",
                    color: arrived ? "#15803d" : "#64748b"
                  }}>
                    {arrived ? "Enter passenger's OTP" : "OTP unlocks on arrival"}
                  </p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                    {arrived ? "Ask passenger for their 4-digit code" : "Drive to pickup point to unlock"}
                  </p>
                </div>
              </div>

              <OtpBoxes value={otp} onChange={v => { setOtp(v); setOtpError("") }}
                disabled={!arrived || submitting} />

              {otpError && (
                <p style={{ textAlign: "center", color: "#dc2626", fontSize: 12, marginTop: 10, fontWeight: 600 }}>
                  ⚠ {otpError}
                </p>
              )}

              <div style={{ marginTop: 14 }}>
                {arrived && otp.length === 4 ? (
                  <SwipeButton
                    label={submitting ? "Verifying…" : "Slide to Verify OTP and Start Ride"}
                    color="#16a34a"
                    disabled={submitting}
                    onSwipeComplete={handleVerify}
                  />
                ) : (
                  <div style={{
                    width: "100%", padding: "14px 0", borderRadius: 14,
                    background: "#e2e8f0", color: "#94a3b8",
                    fontSize: 14, fontWeight: 600, textAlign: "center",
                  }}>
                    {!arrived ? "Drive to passenger first" : "Enter OTP to continue"}
                  </div>
                )}
              </div>

              {!arrived && (
                <button onClick={() => setArrived(true)} style={{
                  width: "100%", marginTop: 10, padding: "11px 0",
                  borderRadius: 12, border: "1.5px solid #cbd5e1",
                  background: "transparent", color: "#64748b",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                  I have reached the pickup point
                </button>
              )}
            </div>
          )}

          {/* Reached Destination — swipe button shown when heading to college */}
          {phase === "toCollege" && (
            <SwipeButton
              label={reachLoading ? "Updating…" : "Slide to Mark as Reached Destination"}
              color="#16a34a"
              disabled={reachLoading}
              onSwipeComplete={handleReached}
            />
          )}

          {/* Report + Help buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowReport(true)} style={{
              flex: 1, padding: "11px 0", borderRadius: 12,
              border: "1.5px solid #fecaca", background: "#fef2f2",
              color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>🚨 Report Issue</button>
            <button onClick={() => setShowHelp(true)} style={{
              flex: 1, padding: "11px 0", borderRadius: 12,
              border: "1.5px solid #e2e8f0", background: "#f8fafc",
              color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>❓ Help</button>
          </div>
        </div>
      </div>
    </>
  )
}
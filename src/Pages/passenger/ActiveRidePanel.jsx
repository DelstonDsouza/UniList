// src/pages/passenger/ActiveRidePanel.jsx
import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useRide } from "../../context/RideContext"
import { socket } from "../../services/socket"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const COLLEGE         = [12.872109642876621, 74.84534749009204]
const AVG_SPEED_KMH   = 40
const PEAK_MULTIPLIER = 1.5
const PEAK_START      = 8
const PEAK_END        = 9

function isPeakHour() {
  const h = new Date().getHours()
  return h >= PEAK_START && h < PEAK_END
}

function calcEta(fromLat, fromLng, toLat, toLng) {
  const R    = 6371
  const dLat = ((toLat - fromLat) * Math.PI) / 180
  const dLng = ((toLng - fromLng) * Math.PI) / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((fromLat * Math.PI) / 180) *
    Math.cos((toLat   * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const speed  = isPeakHour() ? AVG_SPEED_KMH / PEAK_MULTIPLIER : AVG_SPEED_KMH
  return { distKm: Number(distKm.toFixed(1)), etaMin: Math.max(1, Math.round((distKm / speed) * 60)) }
}

// ── Map helpers ───────────────────────────────────────────────────────────────
const riderIcon = new L.DivIcon({
  html: `<div style="background:#0f172a;color:white;border-radius:50%;width:42px;height:42px;
    display:flex;align-items:center;justify-content:center;font-size:22px;
    border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.5)">🛵</div>`,
  className: "", iconSize: [42, 42], iconAnchor: [21, 21],
})
const passengerIcon = new L.DivIcon({
  html: `<div style="background:#14b8a6;color:white;border-radius:50%;width:34px;height:34px;
    display:flex;align-items:center;justify-content:center;font-size:16px;
    border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>`,
  className: "", iconSize: [34, 34], iconAnchor: [17, 17],
})
const collegeIcon = new L.DivIcon({
  html: `<div style="background:#dc2626;color:white;border-radius:50%;width:34px;height:34px;
    display:flex;align-items:center;justify-content:center;font-size:16px;
    border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🎓</div>`,
  className: "", iconSize: [34, 34], iconAnchor: [17, 17],
})

function AutoFit({ positions }) {
  const map  = useMap()
  const prev = useRef("")
  useEffect(() => {
    const pts = positions.filter(Boolean)
    if (pts.length < 2) return
    const key = pts.map(p => p.join(",")).join("|")
    if (prev.current === key) return
    prev.current = key
    try { map.fitBounds(L.latLngBounds(pts), { padding: [52, 52], animate: true, duration: 1.0 }) } catch {}
  }, [positions, map])
  return null
}

// ── Modal shells ──────────────────────────────────────────────────────────────
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
    "Rider was rude or unprofessional",
    "Rider took wrong route",
    "Ride did not happen",
    "Felt unsafe during ride",
    "Rider was not at pickup on time",
    "Other issue",
  ]
  const [selected, setSelected] = useState("")
  const [details,  setDetails]  = useState("")
  const [sent,     setSent]     = useState(false)

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
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Select the issue you experienced:</p>
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
      <textarea
        value={details} onChange={e => setDetails(e.target.value)}
        placeholder="Additional details (optional)…"
        rows={3}
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
    { q: "How do I pay?", a: "Pay cash directly to the rider when you arrive at the destination. ₹5/km, minimum ₹20." },
    { q: "Can I cancel my ride?", a: "Rides cannot be cancelled once confirmed. Contact the rider directly if there's an emergency." },
    { q: "What if the rider doesn't show up?", a: "Wait 5 minutes. If the rider is more than 10 minutes late, use the Report button to flag the issue." },
    { q: "What is the OTP for?", a: "The OTP verifies your identity when the rider arrives. Share the 4-digit code shown on your screen." },
    { q: "Why does ETA increase during peak hours?", a: "Between 8–9 AM, traffic multiplier of 1.5x is applied to give a more realistic arrival estimate." },
    { q: "What if I feel unsafe?", a: "Exit the vehicle if possible and call emergency services (112). Then report the issue using the Report button." },
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
export default function ActiveRidePanel() {
  const { activeRide, fareInfo, viewState } = useRide()

  // ✅ Use passenger's saved pickup location from the ride (set when they booked)
  // Falls back to GPS userLocation only if not available in ride data
  const pickupLat = activeRide?.passenger?.location?.coordinates?.[1]
  const pickupLng = activeRide?.passenger?.location?.coordinates?.[0]
  const passengerPos = pickupLat && pickupLng ? [pickupLat, pickupLng] : null

  const [riderPos,    setRiderPos]    = useState(null)
  const [routeCoords, setRouteCoords] = useState([])
  const [etaToMe,     setEtaToMe]     = useState(null)
  const [etaToDest,   setEtaToDest]   = useState(null)
  const [distToDest,  setDistToDest]  = useState(null)
  const [showReport,  setShowReport]  = useState(false)
  const [showHelp,    setShowHelp]    = useState(false)
  const abortRef = useRef(null)

  const isOngoing = viewState === "ongoing"
  const isWaiting = viewState === "waiting"

  // ── Socket: receive live rider location ───────────────────────────────────
  useEffect(() => {
    if (!activeRide?._id) return
    socket.emit("join:passenger", activeRide._id)
    const handle = ({ lat, lng }) => setRiderPos([lat, lng])
    socket.on("rider:location", handle)
    return () => socket.off("rider:location", handle)
  }, [activeRide?._id])

  // ── Seed initial rider position from ride data ────────────────────────────
  useEffect(() => {
    const lat = activeRide?.currentLocation?.coordinates?.[1]
    const lng = activeRide?.currentLocation?.coordinates?.[0]
    if (lat && lng && !riderPos) setRiderPos([lat, lng])
  }, [activeRide])

  // ── Fetch OSRM route for live polyline ────────────────────────────────────
  useEffect(() => {
    if (!riderPos) return
    // ✅ During waiting: route goes rider → passenger's saved pickup location
    // During ongoing: route goes rider → college
    const dest = isOngoing ? COLLEGE : passengerPos
    if (!dest) return

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${riderPos[1]},${riderPos[0]};${dest[1]},${dest[0]}` +
      `?overview=full&geometries=geojson`

    fetch(url, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        const route = data?.routes?.[0]
        if (!route) return
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        setRouteCoords(coords)
      })
      .catch(e => { if (e.name !== "AbortError") console.warn("OSRM:", e) })

    return () => ctrl.abort()
  }, [riderPos?.[0], riderPos?.[1], isOngoing, passengerPos?.[0], passengerPos?.[1]])

  // ── ETA calculation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!riderPos) return

    if (isWaiting && passengerPos) {
      // ✅ ETA from rider → passenger's saved pickup location (not GPS)
      const { etaMin } = calcEta(riderPos[0], riderPos[1], passengerPos[0], passengerPos[1])
      setEtaToMe(etaMin)
      setEtaToDest(null)
    } else if (isOngoing) {
      const { distKm, etaMin } = calcEta(riderPos[0], riderPos[1], COLLEGE[0], COLLEGE[1])
      setEtaToDest(etaMin)
      setDistToDest(distKm)
      setEtaToMe(null)
    }
  }, [riderPos, passengerPos, isWaiting, isOngoing])

  if (!activeRide) return null

  const mapCenter    = riderPos || passengerPos || COLLEGE
  const otp          = activeRide.otp || null
  const showOtp      = isWaiting && otp

  const fitPositions = isOngoing
    ? [riderPos, COLLEGE].filter(Boolean)
    : [riderPos, passengerPos].filter(Boolean)

  const etaDisplay = isOngoing ? etaToDest : etaToMe
  const etaLabel   = isOngoing ? "ETA to College" : "Rider arrives in"
  const isPeak     = isPeakHour()

  return (
    <>
      {showReport && <ReportModal onClose={() => setShowReport(false)} rideId={activeRide._id} />}
      {showHelp   && <HelpModal  onClose={() => setShowHelp(false)} />}

      <div style={{ minHeight: "100vh", background: "#f1f5f9", paddingBottom: 80 }}>

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 16px 8px",
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: isOngoing ? "#16a34a" : "#d97706",
              letterSpacing: "0.10em", margin: "0 0 2px" }}>
              {isOngoing ? "● RIDE IN PROGRESS" : "● RIDER IS COMING"}
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a" }}>
              {isOngoing ? "On the way to college" : "Your Ride"}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowHelp(true)} style={{
              padding: "8px 14px", borderRadius: 20, border: "1.5px solid #e2e8f0",
              background: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#475569",
            }}>❓ Help</button>
            <button onClick={() => setShowReport(true)} style={{
              padding: "8px 14px", borderRadius: 20, border: "1.5px solid #fecaca",
              background: "#fef2f2", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#dc2626",
            }}>🚨 Report</button>
          </div>
        </div>

        {/* ── BIG ETA ─────────────────────────────────────────────────────── */}
        <div style={{
          margin: "0 16px 12px",
          background: isOngoing ? "#0f172a" : "#1e40af",
          borderRadius: 20, padding: "18px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600,
              letterSpacing: "0.08em", margin: "0 0 4px" }}>
              {etaLabel}
            </p>
            <p style={{ fontSize: 52, fontWeight: 900, color: "white", margin: 0, lineHeight: 1 }}>
              {etaDisplay != null ? `${etaDisplay}` : "—"}
              <span style={{ fontSize: 22, fontWeight: 600, marginLeft: 6, color: "rgba(255,255,255,0.7)" }}>
                {etaDisplay != null ? "min" : ""}
              </span>
            </p>
            {isPeak && (
              <p style={{ fontSize: 11, color: "#fbbf24", marginTop: 4, fontWeight: 600 }}>
                ⚠ Peak hour — 1.5× traffic delay applied
              </p>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            {isOngoing && distToDest != null && (
              <p style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>
                {distToDest} km
              </p>
            )}
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: "4px 0 0" }}>
              {riderPos ? "📡 Live" : "Waiting…"}
            </p>
          </div>
        </div>

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <div style={{ margin: "0 16px 12px", borderRadius: 20, overflow: "hidden",
          boxShadow: "0 2px 12px rgba(0,0,0,0.10)", height: 230 }}>
          <MapContainer center={mapCenter} zoom={14}
            style={{ height: "100%", width: "100%" }} zoomControl scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>' />

            {routeCoords.length > 1 && (
              <Polyline positions={routeCoords}
                pathOptions={{ color: isOngoing ? "#16a34a" : "#2563eb", weight: 5, opacity: 0.85 }} />
            )}

            {/* Rider */}
            {riderPos && <Marker position={riderPos} icon={riderIcon} />}

            {/* ✅ Passenger's saved pickup location (not GPS) */}
            {!isOngoing && passengerPos && (
              <Marker position={passengerPos} icon={passengerIcon} />
            )}

            {/* College */}
            {isOngoing && <Marker position={COLLEGE} icon={collegeIcon} />}

            <AutoFit positions={fitPositions} />
          </MapContainer>
        </div>

        {/* ── Rider card ───────────────────────────────────────────────────── */}
        <div style={{
          margin: "0 16px 12px", background: "#0f172a",
          borderRadius: 20, padding: "16px 18px", color: "white",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "#14b8a6",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 900, flexShrink: 0,
            }}>
              {(activeRide.riderName || "R")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 20, fontWeight: 800, margin: "0 0 2px" }}>{activeRide.riderName}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0 }}>
                {riderPos ? "📡 Live location active" : "Waiting for location…"}
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#1e293b", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ fontSize: 10, color: "#64748b", margin: "0 0 4px", fontWeight: 600 }}>PHONE</p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{activeRide.riderPhone || "—"}</p>
            </div>
            <div style={{ background: "#1e293b", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ fontSize: 10, color: "#64748b", margin: "0 0 4px", fontWeight: 600 }}>VEHICLE</p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "0.08em" }}>
                {activeRide.scooterNumber || "—"}
              </p>
            </div>
            <div style={{ background: "#14b8a6", borderRadius: 14, padding: "12px 14px", gridColumn: "1 / -1" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", margin: "0 0 2px", fontWeight: 600 }}>FARE</p>
              <p style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
                ₹{fareInfo?.amount ?? activeRide?.fare?.amount ?? "—"}
                <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 6, opacity: 0.8 }}>cash</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── OTP card ─────────────────────────────────────────────────────── */}
        {showOtp && (
          <div style={{
            margin: "0 16px 12px", background: "white",
            border: "2.5px solid #14b8a6", borderRadius: 20,
            padding: "20px 18px", textAlign: "center",
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#475569", margin: "0 0 14px" }}>
              🔐 Share this OTP when the rider arrives at pickup
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
              {otp.split("").map((digit, i) => (
                <div key={i} style={{
                  width: 58, height: 68, borderRadius: 14,
                  background: "#0f172a", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 34, fontWeight: 900,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                }}>{digit}</div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
              Do not share with anyone else
            </p>
          </div>
        )}

        {/* ── Safety note ──────────────────────────────────────────────────── */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", padding: "0 16px" }}>
          Live tracking via socket · Ride cannot be cancelled
          {isPeak ? " · Peak hour delays apply" : ""}
        </p>
      </div>
    </>
  )
}
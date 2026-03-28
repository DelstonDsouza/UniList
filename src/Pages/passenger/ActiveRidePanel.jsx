// src/pages/passenger/ActiveRidePanel.jsx
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useRide } from "../../context/RideContext"
import { socket } from "../../services/socket"
import { motion, useMotionValue, useAnimation } from "framer-motion"


delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const COLLEGE = [12.872109642876621, 74.84534749009204]

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

function ReportModal({ onClose }) {
  const reasons = [
    "Rider was rude or unprofessional", "Rider took wrong route",
    "Ride did not happen", "Felt unsafe during ride",
    "Rider was not at pickup on time", "Other issue",
  ]
  const [selected, setSelected] = useState("")
  const [details, setDetails] = useState("")
  const [sent, setSent] = useState(false)

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
      <textarea value={details} onChange={e => setDetails(e.target.value)}
        placeholder="Additional details (optional)…" rows={3}
        style={{
          width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 13,
          border: "1.5px solid #e2e8f0", resize: "none", outline: "none",
          fontFamily: "inherit", boxSizing: "border-box",
        }}
      />
      <button onClick={() => selected && setSent(true)} disabled={!selected} style={{
        marginTop: 14, width: "100%", padding: "14px 0", borderRadius: 14,
        background: selected ? "#dc2626" : "#e2e8f0", color: selected ? "white" : "#94a3b8",
        fontWeight: 700, fontSize: 15, border: "none", cursor: selected ? "pointer" : "not-allowed",
      }}>Submit Report</button>
    </Modal>
  )
}

function HelpModal({ onClose }) {
  const faqs = [
    { q: "How do I pay?", a: "Pay cash directly to the rider when you arrive. ₹5/km, minimum ₹25." },
    { q: "Can I cancel my ride?", a: "Rides cannot be cancelled once confirmed. Contact the rider directly if needed." },
    { q: "What if the rider doesn't show up?", a: "Wait 5 minutes then use the Report button to flag the issue." },
    { q: "What is the OTP for?", a: "The OTP verifies your identity. Share the 4-digit code when the rider arrives." },
    { q: "What if I feel unsafe?", a: "Exit the vehicle and call 112. Then report the issue using the Report button." },
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ActiveRidePanel() {
  const { activeRide, fareInfo, viewState } = useRide()

  // ── Framer Motion Bottom Sheet Logic ──
  const [dims, setDims] = useState({ vh: window.innerHeight })
  useEffect(() => {
    const fn = () => setDims({ vh: window.innerHeight })
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])

  const BOTTOM_NAV = 70;
  const SHEET_FULL = 140;
  const SHEET_HALF = dims.vh * 0.45;
  const SHEET_COLLAPSED = dims.vh - BOTTOM_NAV - 180;

  const sheetY = useMotionValue(SHEET_HALF)
  const sheetControls = useAnimation()

  useEffect(() => { sheetControls.start({ y: SHEET_HALF }) }, [SHEET_HALF, sheetControls])

  const handleDragEnd = (_, info) => {
    const currY = sheetY.get()
    const velocity = info.velocity.y
    const points = [SHEET_FULL, SHEET_HALF, SHEET_COLLAPSED]
    let closest = points[0]; let minDiff = Math.abs(currY - points[0])
    points.forEach(p => { const d = Math.abs(currY - p); if (d < minDiff) { minDiff = d; closest = p } })

    let target = closest;
    if (velocity < -120) { if (currY > SHEET_HALF + 50) target = SHEET_HALF; else target = SHEET_FULL }
    else if (velocity > 120) { if (currY < SHEET_HALF - 50) target = SHEET_HALF; else target = SHEET_COLLAPSED }

    sheetControls.start({ y: target, transition: { type: "spring", bounce: 0, duration: 0.4 } })
  }

  const pickupLat = activeRide?.passenger?.location?.coordinates?.[1]
  const pickupLng = activeRide?.passenger?.location?.coordinates?.[0]
  const passengerPos = (pickupLat && pickupLng) ? [pickupLat, pickupLng] : null

  const [riderPos, setRiderPos] = useState(null)
  const [routeCoords, setRouteCoords] = useState([])
  const [etaToMe, setEtaToMe] = useState(null)
  const [etaToDest, setEtaToDest] = useState(null)
  const [distToDest, setDistToDest] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const abortRef = useRef(null)

  const navigate = useNavigate()

  const isWaiting = viewState === "waiting"
  const isOngoing = viewState === "ongoing"

  const destPin = isOngoing ? COLLEGE : passengerPos
  const routeColor = isOngoing ? "#16a34a" : "#2563EB"

  // ── Socket: join room + live rider location ───────────────────────────────
  useEffect(() => {
    if (!activeRide?._id) return
    socket.emit("join:passenger", activeRide._id)
    const handleLocation = ({ lat, lng }) => setRiderPos([lat, lng])

    // When rider marks destination reached → go to payment page
    const handleReached = (data) => {
      navigate("/passenger-payment", {
        replace: true,
        state: {
          rideId: activeRide._id,
          distanceKm: data?.distanceKm ?? data?.distance ?? null,
          fare: data?.fare ?? fareInfo?.amount ?? activeRide?.fare?.amount ?? null,
          riderName: activeRide.riderName,
        },
      })
    }

    socket.on("rider:location", handleLocation)
    socket.on("ride:reached_destination", handleReached)
    return () => {
      socket.off("rider:location", handleLocation)
      socket.off("ride:reached_destination", handleReached)
    }
  }, [activeRide?._id])

  // ── Seed riderPos from last known location in ride doc ────────────────────
  useEffect(() => {
    const lat = activeRide?.currentLocation?.coordinates?.[1]
    const lng = activeRide?.currentLocation?.coordinates?.[0]
    if (lat && lng && !riderPos) setRiderPos([lat, lng])
  }, [activeRide]) // eslint-disable-line

  // ── Fetch OSRM route + use OSRM duration for ETA ─────────────────────────
  // This matches the rider side which also uses OSRM duration, not haversine
  useEffect(() => {
    if (!riderPos) return
    const dest = isOngoing ? COLLEGE : passengerPos
    if (!dest) return

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    fetch(
      `https://router.project-osrm.org/route/v1/driving/` +
      `${riderPos[1]},${riderPos[0]};${dest[1]},${dest[0]}` +
      `?overview=full&geometries=geojson`,
      { signal: ctrl.signal }
    )
      .then(r => r.json())
      .then(data => {
        const route = data?.routes?.[0]
        if (!route) return

        // Polyline
        setRouteCoords(route.geometry.coordinates.map(([lng, lat]) => [lat, lng]))

        // ✅ OSRM duration in seconds → round to minutes (same source as rider side)
        const durationMin = Math.round(route.duration / 60)
        const distKm = Number((route.distance / 1000).toFixed(1))

        if (isWaiting) {
          setEtaToMe(durationMin)
          setEtaToDest(null)
          setDistToDest(null)
        } else if (isOngoing) {
          setEtaToDest(durationMin)
          setDistToDest(distKm)
          setEtaToMe(null)
        }
      })
      .catch(e => { if (e.name !== "AbortError") console.warn("OSRM:", e) })

    return () => ctrl.abort()
  }, [riderPos?.[0], riderPos?.[1], isOngoing, isWaiting, passengerPos?.[0], passengerPos?.[1]]) // eslint-disable-line

  if (!activeRide) return null

  const mapCenter = riderPos || passengerPos || COLLEGE
  const otp = activeRide.otp || null
  const fare = fareInfo?.amount ?? activeRide?.fare?.amount ?? "—"
  const etaDisplay = isOngoing ? etaToDest : etaToMe
  const etaLabel = isOngoing ? "REACHING COLLEGE IN " : "RIDER ARRIVES IN"

  return (
    <>
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}


      <div className="absolute inset-0 z-0 bg-gray-100 h-[100dvh]">

        {/* MAP CONTAINER */}
        <div className="absolute inset-0 z-0">
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
                <PinLayer position={riderPos} color="black" emoji="🏍" label={activeRide.riderName || "Rider"} />
                <AccuracyRing position={riderPos} />
              </>
            )}
            {destPin && (
              <PinLayer
                position={destPin}
                color={isOngoing ? "#dc2626" : "black"}
                emoji={isOngoing ? "🎓" : "📍"}
                label={isOngoing ? "College" : "Your Pickup"}
              />
            )}
          </MapContainer>


          <div style={{ position: "absolute", top: "max(1rem, env(safe-area-inset-top))", right: 14, zIndex: 500, display: "flex", gap: 8 }}>
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

        {/* DRAGGABLE BOTTOM SHEET */}
        <motion.div
          drag="y"
          dragConstraints={{ top: SHEET_FULL, bottom: SHEET_COLLAPSED }}
          dragElastic={{ top: 0, bottom: 0.15 }}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          animate={sheetControls}
          style={{ y: sheetY, height: dims.vh - SHEET_FULL }}
          className="absolute top-0 left-0 right-0 z-20 bg-white rounded-t-[32px] shadow-[0_-15px_40px_rgba(0,0,0,0.08)] flex flex-col pt-3"
        >
          {/* DRAG HANDLE */}
          <div className="w-full pb-3 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing shrink-0" style={{ touchAction: 'none' }}>
            <div style={{ width: 44, height: 5, background: "#cbd5e1", borderRadius: 99 }} />
          </div>

          <div style={{
            flex: 1, background: "white", padding: "0 20px 90px",
            display: "flex", flexDirection: "column", gap: 12, overflowY: "auto",
            touchAction: "pan-y"
          }} onPointerDown={e => e.stopPropagation()}>

            <div>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", margin: "0 0 2px",
                color: isOngoing ? "#16a34a" : "#2563EB"
              }}>
                {isOngoing ? "RIDE IN PROGRESS" : "Pickup Passenger"}
              </p>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                {isOngoing ? "Heading to College" : "Rider is on the way"}
              </h2>
            </div>

            <div style={{
              background: isOngoing ? "#0f172a" : "#1e40af",
              borderRadius: 18, padding: "16px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <p style={{
                  fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600,
                  letterSpacing: "0.08em", margin: "0 0 2px"
                }}>{etaLabel}</p>
                <p style={{ fontSize: 48, fontWeight: 900, color: "white", margin: 0, lineHeight: 1 }}>
                  {etaDisplay != null ? etaDisplay : "—"}
                  <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 6, color: "rgba(255,255,255,0.6)" }}>
                    {etaDisplay != null ? "min" : ""}
                  </span>
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                {isOngoing && distToDest != null && (
                  <p style={{ fontSize: 26, fontWeight: 800, color: "white", margin: "0 0 4px" }}>
                    {distToDest} km
                  </p>
                )}
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  {riderPos ? "" : "Waiting…"}
                </p>
              </div>
            </div>

            <div style={{ background: "#F0F9FF", border: "1.5px solid #BFDBFE", borderRadius: 16, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 18, fontWeight: 800,
                  }}>{(activeRide.riderName || "R")[0].toUpperCase()}</div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: "0 0 2px" }}>
                      {activeRide.riderName || "—"}
                    </p>
                    {activeRide.riderPhone && (
                      <a href={`tel:${activeRide.riderPhone}`}
                        style={{ fontSize: 12, color: "#2563EB", textDecoration: "none" }}>
                        📞 {activeRide.riderPhone}
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

            {isWaiting && otp && (
              <div style={{
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 16, padding: "14px 16px",
              }}>
                <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 12px", color: "#475569", textAlign: "center" }}>
                  Share this OTP at pickup
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                  {otp.split("").map((digit, i) => (
                    <div key={i} style={{
                      width: 50, height: 60, borderRadius: 12,
                      background: "#0f172a", color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28, fontWeight: 900, boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                    }}>{digit}</div>
                  ))}
                </div>
                <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 10, margin: "10px 0 0" }}>
                  Do not share with anyone else
                </p>
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </>
  )
}
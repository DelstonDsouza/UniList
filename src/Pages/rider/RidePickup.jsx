// src/pages/rider/RidePickup.jsx
import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { apiFetch } from "../../services/api"
import { socket, connectSocket } from "../../services/socket"
import toast from "react-hot-toast"
import SwipeButton from "../../components/ui/SwipeButton"
import { motion, useMotionValue, useAnimation, AnimatePresence } from "framer-motion"
import { Compass, Clock, User } from "lucide-react"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const COLLEGE = [12.791147585453782, 74.86214146337976]
const AVG_SPEED_KMH = 40
const PEAK_START = 8
const PEAK_END = 9

function isPeakHour() {
  const h = new Date().getHours()
  return h >= PEAK_START && h < PEAK_END
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

// \u2500 Map components \u2500
function PinLayer({ position, type, label }) {
  const map = useMap()
  useEffect(() => {
    if (!position) return
    let html = ""
    let size = [22, 22]
    let anchor = [11, 11]

    if (type === "pickup" || type === "rider") {
      html = `<div style="background-color: #0f766e; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`
      size = [22, 22]; anchor = [11, 11]
    } else if (type === "destination") {
      html = `<div style="background-color: #ef4444; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.3);"><div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div></div>`
      size = [26, 26]; anchor = [13, 13]
    }

    const icon = L.divIcon({ className: "", html, iconSize: size, iconAnchor: anchor })
    const m = L.marker(position, { icon }).addTo(map)
    if (label) m.bindTooltip(label, {
      permanent: true, direction: "top", offset: [0, -15],
      className: "leaflet-tooltip-custom"
    })
    return () => { try { m.remove() } catch { } }
  }, [position?.[0], position?.[1], map, type])
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

// \u2500 OTP input boxes \u2500
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
            width: 50, height: 60, fontSize: 32, fontWeight: 900, textAlign: "center",
            borderRadius: 16,
            background: "white",
            color: "#0f172a", outline: "none",
            border: value[i] ? "2.5px solid #22c55e" : "2px solid #e2e8f0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            transition: "all 0.2s ease"
          }}
        />
      ))}
    </div>
  )
}

// \u2500 Modal shell \u2500
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
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

// \u2500 Main component \u2500
export default function RidePickup() {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()

  const [rideData, setRideData] = useState(state || null)
  const [bootstrapping, setBootstrapping] = useState(!rideData)

  const [riderPos, setRiderPos] = useState(state?.userLocation ?? null)
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
  const [reachLoading, setReachLoading] = useState(false)

  // ── Bottom Sheet Logic ──
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

  const watchRef = useRef(null)
  const abortRef = useRef(null)

  // \u2500 Sync Ride on Mount \u2500
  useEffect(() => {
    if (rideData && rideData.rideId === id) {
      setBootstrapping(false)
      // Do not return here! Always fetch latest from server to avoid stale state bugs on refresh
    }
    apiFetch(`/rides/${id}`)
      .then(res => {
        const r = res.data.ride
        if (!["locked", "pickup_started", "ongoing", "reached_destination"].includes(r.status)) {
          navigate("/rider-home", { replace: true })
          return
        }
        const mapped = {
          rideId: r._id,
          passengerName: r.passenger?.name || "Passenger",
          passengerPhone: r.passenger?.phone || "",
          passengerPickup: r.passenger?.location?.coordinates ? [r.passenger.location.coordinates[1], r.passenger.location.coordinates[0]] : null,
          fare: r.fare?.amount || 20,
          distanceKm: r.fare?.distanceKm || 0,
          userLocation: riderPos
        }
        setRideData(mapped)
        if (r.status === "ongoing" || r.status === "reached_destination") {
          setPhase("toCollege")
          setArrived(true)
        } else if (r.status === "pickup_started") {
          setArrived(true)
        }
        setBootstrapping(false)
      })
      .catch(() => {
        navigate("/rider-home", { replace: true })
      })
  }, [id])

  const {
    passengerName = "Passenger",
    passengerPhone = "",
    passengerPickup = null,
    fare = 20,
    distanceKm = 0
  } = rideData || {}

  useEffect(() => {
    if (!id) return
    connectSocket()
    socket.emit("join:ride", id)
  }, [id])

  useEffect(() => {
    if (!navigator.geolocation || !id) return
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setRiderPos([lat, lng])
        socket.emit("rider:location", { rideId: id, lat, lng })
      },
      () => { },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
    return () => { try { navigator.geolocation.clearWatch(watchRef.current) } catch { } }
  }, [id])

  useEffect(() => {
    if (!riderPos) return
    const dest = phase === "toCollege" ? COLLEGE : passengerPickup
    if (!dest) return

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    getOsrmRoute(riderPos, dest, ctrl.signal).then(r => {
      if (!r) return
      setRouteCoords(r.coords)
      if (phase === "toPassenger") {
        setEtaToPass(r.durationMin)
        const isNear = riderPos && passengerPickup &&
          riderPos[0] !== 0 && passengerPickup[0] !== 0 &&
          haversineM(riderPos, passengerPickup) <= 80
        if (isNear) setArrived(true)
      } else {
        setEtaToCol(r.durationMin)
        setDistToCol(r.distKm)
      }
    })
    return () => ctrl.abort()
  }, [riderPos?.[0], riderPos?.[1], phase, passengerPickup])

  const handleVerify = async () => {
    if (otp.length < 4) { setOtpError("Enter all 4 digits"); return }
    setSubmitting(true); setOtpError("")
    try {
      await apiFetch(`/rides/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      })
      setPhase("toCollege")
      setRouteCoords([])
    } catch (e) {
      setOtpError(e?.message || "Wrong OTP. Please try again.")
      setOtp("")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReached = async () => {
    setReachLoading(true)
    try {
      const data = await apiFetch(`/rides/${id}/reached`, { method: "POST" })
      const serverDistKm = data?.data?.ride?.fare?.distanceKm ?? distanceKm
      const serverFare = data?.data?.ride?.fare?.amount ?? fare
      navigate("/rider-payment", {
        replace: true,
        state: { rideId: id, distanceKm: serverDistKm, fare: serverFare, passengerName },
      })
    } catch (e) {
      toast.error(e?.message || "Could not mark as reached. Try again.")
    } finally {
      setReachLoading(false)
    }
  }

  const onArrivedClick = async () => {
    setArrived(true) // Instant UI feedback
    try {
      await apiFetch(`/rides/${id}/arrive`, { method: "POST" })
    } catch (e) {
      console.error("Arrive update failed:", e)
    }
  }

  const mapCenter = riderPos ?? passengerPickup ?? COLLEGE
  const currentEta = phase === "toCollege" ? etaToCol : etaToPass
  const routeColor = "#0d9488"
  const destPin = phase === "toCollege" ? COLLEGE : passengerPickup

  if (bootstrapping) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: "white", gap: 16 }}>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#0f172a", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <p style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>Syncing ride details…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <>
      {showReport && <ReportModal onClose={() => setShowReport(false)} rideId={id} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <div className="absolute inset-0 z-0 bg-gray-100 h-[100dvh]">
        <div className="absolute inset-0 z-0">
          <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CARTO'
              maxZoom={20}
            />
            {routeCoords.length > 1 && (
              <Polyline positions={routeCoords} pathOptions={{ color: routeColor, weight: 5, opacity: 0.8 }} />
            )}
            {routeCoords.length > 1 && <FitRoute coords={routeCoords} />}
            {riderPos && (
              <>
                <PinLayer position={riderPos} type="rider" label="You" />
                <AccuracyRing position={riderPos} />
              </>
            )}
            {destPin && (
              <PinLayer
                position={destPin}
                type={phase === "toCollege" ? "destination" : "pickup"}
                label={phase === "toCollege" ? "College" : passengerName}
              />
            )}
          </MapContainer>
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
                color: "#2563EB"
              }}>
                Pickup Passenger
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                {phase === "toCollege" ? "Going to College" : "Enter Passenger OTP"}
              </h2>
            </div>

            <div style={{
              background: phase === "toCollege" ? "#0f172a" : "#2244bb",
              borderRadius: 20, padding: "20px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              boxShadow: "0 8px 24px rgba(34,68,187,0.15)"
            }}>
              <div>
                <p style={{
                  fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 700,
                  letterSpacing: "0.08em", margin: "0 0 4px"
                }}>{phase === "toCollege" ? "ETA TO COLLEGE" : "ETA TO PASSENGER"}</p>
                <p style={{ fontSize: 44, fontWeight: 900, color: "white", margin: 0, lineHeight: 1 }}>
                  {currentEta ?? "--"}
                  <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 8, color: "rgba(255,255,255,0.6)" }}>
                    {currentEta != null ? "min" : ""}
                  </span>
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                {phase === "toCollege" && distToCol != null && (
                  <p style={{ fontSize: 24, fontWeight: 800, color: "white", margin: "0 0 4px" }}>
                    {distToCol} km
                  </p>
                )}
              </div>
            </div>

            <div style={{
              background: "white", border: "2px solid #e0f2fe", borderRadius: 20,
              padding: "16px 18px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "#2563EB",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 20, fontWeight: 900,
                }}>{(passengerName || "P")[0].toUpperCase()}</div>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", margin: "0 0 2px" }}>
                    {passengerName}
                  </p>
                  <a href={`tel:${passengerPhone}`} className="text-sm text-blue-600 font-bold block flex items-center gap-1">
                    📞 <span style={{ fontSize: 13 }}>{passengerPhone}</span>
                  </a>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 18, fontWeight: 900, color: "#16a34a", margin: 0 }}>₹{fare}</p>
                <p style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>cash</p>
              </div>
            </div>

            {phase === "toPassenger" && (
              <div style={{
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 20, padding: "20px 18px", marginTop: 4
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>





                  <div style={{
                    opacity: arrived ? 1 : 0.45,
                    filter: arrived ? "none" : "grayscale(0.5)",
                    pointerEvents: arrived ? "auto" : "none",
                    transition: "all 0.3s ease"
                  }}>
                    <p style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: "#475569", marginBottom: 12 }}>
                      Enter passenger's OTP {!arrived && "(Locked)"}
                    </p>
                    <OtpBoxes value={otp} onChange={setOtp} disabled={submitting || !arrived} />
                    {otpError && <p style={{ textAlign: "center", color: "#dc2626", fontSize: 12, fontWeight: 600, marginTop: 10 }}>{otpError}</p>}

                    {otp.length === 4 && arrived && (
                      <div style={{ marginTop: 20 }}>
                        <SwipeButton label="Slide to Verify OTP and Start Ride" color="#16a34a" onSwipeComplete={handleVerify} disabled={submitting} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {phase === "toCollege" && (
              <SwipeButton label="Slide to Mark as Reached" color="#16a34a" onSwipeComplete={handleReached} disabled={reachLoading} />
            )}
          </div>
        </motion.div>
        <BottomNav />
      </div>
    </>
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
          <button key={t.id} onClick={() => {
            if (t.id === "home") return;
            navigate("/rider-home", { state: { tab: t.id } });
          }} className="flex flex-col items-center gap-1.5 flex-1 relative group">
            <Icon className={`w-6 h-6 transition-colors duration-300 ${active ? "text-teal-600" : "text-gray-400 group-hover:text-gray-600"}`} />
            <span className={`text-[10px] uppercase tracking-wider font-semibold transition-colors ${active ? "text-teal-600" : "text-gray-400 group-hover:text-gray-600"}`}>{t.label}</span>
            {active && <motion.div layoutId="nav-pill" className="absolute -bottom-2 w-1.5 h-1.5 bg-teal-500 rounded-full" />}
          </button>
        )
      })}
    </div>
  );
}
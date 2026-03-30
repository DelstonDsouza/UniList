import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../../services/api"

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Auto-format a raw vehicle plate string to: XX 00 XX 0000
 * Accepts input mid-typing and formats on the fly.
 */
function formatVehiclePlate(raw) {
  // Remove all non-alphanumeric, uppercase
  const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  // Group: 2 letters, 2 digits, 2 letters, 1-4 digits
  const p1 = clean.slice(0, 2)
  const p2 = clean.slice(2, 4)
  const p3 = clean.slice(4, 6)
  const p4 = clean.slice(6, 10)
  const parts = [p1, p2, p3, p4].filter(Boolean)
  return parts.join(" ")
}

const LICENSE_REGEX = /^[A-Z]{2}\d{2}\s?\d{4}\d{7}$/

function validateLicense(val) {
  const clean = val.replace(/\s/g, "")
  if (!clean) return "License number is required"
  if (clean.length < 15) return "License number must be 15 characters"
  if (!/^[A-Z]{2}/.test(clean)) return "Must start with 2 state letters (e.g. KA)"
  if (!LICENSE_REGEX.test(val.replace(/\s/g, ""))) return "Enter a valid license number"
  return ""
}

function validatePlate(val) {
  const clean = val.replace(/\s/g, "")
  if (!clean) return "Vehicle number is required"
  if (clean.length < 8) return "Enter a valid vehicle number"
  if (!/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{1,4}$/.test(clean)) return "Format: KA 01 AB 1234"
  return ""
}

// ─── Info Card ───────────────────────────────────────────────────────────────

function InfoCard({ icon, title, body }) {
  return (
    <div className="flex gap-4 items-start">
      <div
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(99, 102, 241, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: 15, color: "#1e293b", marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  )
}

// ─── Step ────────────────────────────────────────────────────────────────────

function Step({ num, label }) {
  return (
    <div className="flex items-center gap-3">
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#6366f1",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {num}
      </div>
      <span style={{ fontSize: 14, color: "#334155", fontWeight: 500 }}>{label}</span>
    </div>
  )
}

// ─── BecomeRiderPage ─────────────────────────────────────────────────────────

function BecomeRiderPage({ onRegisterNow, onCancel }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "20px 24px",
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 8px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            color: "#64748b",
          }}
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: "#0f172a" }}>Become a Rider</span>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px 0" }}>
        {/* Hero */}
        <div
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            borderRadius: 20,
            padding: "36px 32px",
            marginBottom: 32,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -20,
              right: 40,
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
            }}
          />
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.15)",
              borderRadius: 10,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            RideMate for Riders
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.25,
              marginBottom: 10,
            }}
          >
            Share your commute.<br />Offset your fuel costs.
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", lineHeight: 1.65 }}>
            RideMate connects college students heading the same direction. Offer a pillion seat and
            split petrol costs — no earnings, no commercial rules.
          </p>
        </div>

        {/* Benefits */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "24px 20px",
            border: "1px solid #e2e8f0",
            marginBottom: 20,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Why join as a rider
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <InfoCard
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              }
              title="Save on fuel every day"
              body="Passengers contribute towards petrol cost. Your regular commute becomes significantly cheaper."
            />
            <InfoCard
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              title="College-only community"
              body="Only verified students from your institution can book rides. Familiar faces, trusted network."
            />
            <InfoCard
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
              title="Safe and transparent"
              body="Every ride is logged. Vehicle details and license are verified before you can offer rides."
            />
          </div>
        </div>

        {/* How it works */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "24px 20px",
            border: "1px solid #e2e8f0",
            marginBottom: 32,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            How it works
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Step num={1} label="Register with your driving license and vehicle details" />
            <Step num={2} label="Post a ride when you are heading to college" />
            <Step num={3} label="A passenger books your ride from the app" />
            <Step num={4} label="Pick them up, drop them off, and receive the fuel share" />
          </div>
        </div>

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "15px 0",
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              background: "#fff",
              color: "#64748b",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#f8fafc")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
          >
            Cancel
          </button>
          <button
            onClick={onRegisterNow}
            style={{
              flex: 2,
              padding: "15px 0",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              transition: "opacity 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.92")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Register Now
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── BecomeRiderModal ────────────────────────────────────────────────────────

function BecomeRiderModal({ onClose, onSuccess }) {
  const [licenseNumber, setLicenseNumber] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [vehicleType, setVehicleType] = useState("bike")
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef(null)

  const handleLicenseChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "")
    if (raw.length > 18) return
    setLicenseNumber(raw)
    if (errors.license) setErrors((prev) => ({ ...prev, license: "" }))
  }

  const handleVehicleChange = (e) => {
    const formatted = formatVehiclePlate(e.target.value)
    setVehicleNumber(formatted)
    if (errors.vehicle) setErrors((prev) => ({ ...prev, vehicle: "" }))
  }

  const validate = () => {
    const errs = {}
    const licErr = validateLicense(licenseNumber)
    if (licErr) errs.license = licErr
    const vehErr = validatePlate(vehicleNumber)
    if (vehErr) errs.vehicle = vehErr
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await apiFetch("/rider/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseNo: licenseNumber.replace(/\s/g, ""),
          vehicleNo: vehicleNumber.replace(/\s/g, ""),
          vehicleType,
        }),
      })
      const raw = localStorage.getItem("user")
      const u = raw ? JSON.parse(raw) : {}
      localStorage.setItem(
        "user",
        JSON.stringify({ ...u, isRider: true, licenseNumber, vehicleNumber, vehicleType })
      )
      onSuccess()
    } catch (err) {
      setErrors({ submit: err.message || "Registration failed. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  const inputBase = {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 10,
    border: "1.5px solid #e2e8f0",
    fontSize: 15,
    color: "#0f172a",
    background: "#fff",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  }

  const inputError = { ...inputBase, border: "1.5px solid #ef4444" }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        backdropFilter: "blur(2px)",
        animation: "fadeIn 0.18s ease",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(60px); opacity:0 } to { transform:translateY(0); opacity:1 } }
      `}</style>
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          padding: "0 0 32px",
          animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0" }} />
        </div>

        {/* Modal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px 0",
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
              Rider Registration
            </h2>
            <p style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400 }}>
              Enter details as per your driving license
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Vehicle Type */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#334155",
                marginBottom: 10,
              }}
            >
              Vehicle Type
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {["bike", "scooter"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVehicleType(type)}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    borderRadius: 10,
                    border: vehicleType === type ? "2px solid #6366f1" : "1.5px solid #e2e8f0",
                    background: vehicleType === type ? "rgba(99,102,241,0.07)" : "#fff",
                    color: vehicleType === type ? "#4f46e5" : "#64748b",
                    fontWeight: vehicleType === type ? 700 : 500,
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textTransform: "capitalize",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {type === "bike" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" />
                      <path d="M15 6a1 1 0 0 0 0-2h-3l-3 9H3" />
                      <path d="m18.5 17.5-5-5 1.5-4h-3" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" />
                      <path d="M12 4H9L7.5 10H3" /><path d="m18.5 17.5-3-5h-5l-2-5" />
                      <path d="M12 4c0 0 4 0 5 3l1 5" />
                    </svg>
                  )}
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Driving License Number */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
              Driving License Number
            </label>
            <input
              id="license-number"
              type="text"
              placeholder="KA01 20190012345"
              value={licenseNumber}
              onChange={handleLicenseChange}
              maxLength={18}
              style={errors.license ? inputError : inputBase}
              onFocus={(e) => {
                if (!errors.license) e.target.style.borderColor = "#6366f1"
              }}
              onBlur={(e) => {
                if (!errors.license) e.target.style.borderColor = "#e2e8f0"
              }}
            />
            {errors.license && (
              <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: 500 }}>
                {errors.license}
              </p>
            )}
          </div>

          {/* Vehicle Number Plate */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
              Vehicle Number Plate
            </label>
            <input
              id="vehicle-number"
              type="text"
              placeholder="KA 01 AB 1234"
              value={vehicleNumber}
              onChange={handleVehicleChange}
              maxLength={13}
              style={errors.vehicle ? inputError : inputBase}
              onFocus={(e) => {
                if (!errors.vehicle) e.target.style.borderColor = "#6366f1"
              }}
              onBlur={(e) => {
                if (!errors.vehicle) e.target.style.borderColor = "#e2e8f0"
              }}
            />
            {errors.vehicle && (
              <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: 500 }}>
                {errors.vehicle}
              </p>
            )}
          </div>

          {/* Submit error */}
          {errors.submit && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                color: "#dc2626",
                fontWeight: 500,
              }}
            >
              {errors.submit}
            </div>
          )}

          {/* Divider before buttons */}
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 4 }} />

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: 12,
                border: "1.5px solid #e2e8f0",
                background: "#fff",
                color: "#64748b",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: loading ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              id="register-rider-btn"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 2,
                padding: "14px 0",
                borderRadius: 12,
                border: "none",
                background: loading
                  ? "#a5b4fc"
                  : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 16px rgba(99,102,241,0.30)",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "opacity 0.15s",
              }}
            >
              {loading ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  >
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                  Registering...
                </>
              ) : (
                "Register"
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ─── SuccessScreen ────────────────────────────────────────────────────────────

function SuccessScreen({ onContinue }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 24,
          padding: "48px 32px 36px",
          textAlign: "center",
          animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Check icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#0f172a",
            marginBottom: 10,
          }}
        >
          You are now a Rider
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#64748b",
            lineHeight: 1.65,
            marginBottom: 32,
          }}
        >
          Your rider profile is set up. You can now post rides and help fellow
          students while sharing fuel costs.
        </p>

        <button
          id="rider-success-continue"
          onClick={onContinue}
          style={{
            width: "100%",
            padding: "15px 0",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(99,102,241,0.30)",
            fontFamily: "inherit",
          }}
        >
          Continue to Rider Dashboard
        </button>
      </div>
    </div>
  )
}

// ─── Root Component ──────────────────────────────────────────────────────────

function BecomeRider() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem("user")
    const u = raw ? JSON.parse(raw) : null
    if (u && u.isRider) navigate("/giveride", { replace: true })
  }, [navigate])

  const handleSuccess = () => {
    setShowModal(false)
    setShowSuccess(true)
  }

  const handleContinue = () => {
    navigate("/giveride")
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      `}</style>

      <BecomeRiderPage
        onRegisterNow={() => setShowModal(true)}
        onCancel={() => navigate(-1)}
      />

      {showModal && (
        <BecomeRiderModal
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showSuccess && <SuccessScreen onContinue={handleContinue} />}
    </>
  )
}

export default BecomeRider

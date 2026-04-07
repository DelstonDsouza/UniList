import { useState, useRef, useEffect } from "react"
import { useRide } from "../context/RideContext"
import { useNavigate, useLocation } from "react-router-dom"

export default function GlobalHelp() {
  const {
    hasActiveRide,
    cancelCurrentRide,
    cancellationAlert,
    setCancellationAlert,
    activeRideRole,
    activeRide
  } = useRide()

  const navigate = useNavigate()
  const location = useLocation()
  const menuRef = useRef(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // ── Handle Click Outside ──
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  // ── Visibility Logic ──
  // Hide if on History/Profile tabs (even if ride is active)
  const currentTab = location.state?.tab || "home"
  const isHistoryOrProfile = currentTab === "history" || currentTab === "account" || currentTab === "profile"

  if (!hasActiveRide && !cancellationAlert) return null
  if (isHistoryOrProfile) return null

  const handleCancelClick = async () => {
    setCancelling(true)
    const roleBeforeCancel = activeRideRole
    try {
      await cancelCurrentRide()
      setShowConfirm(false)
      setShowMenu(false)
      // Navigate back to home/dashboard since the ride is gone
      navigate(roleBeforeCancel === "rider" ? "/rider-home" : "/dashboard")
    } catch {
      alert("Failed to cancel ride. Please try again.")
    } finally {
      setCancelling(false)
    }
  }

  const goToSupport = () => {
    setShowMenu(false)
    const state = { tab: "account", accountView: "help" }

    if (activeRideRole === "rider") {
      navigate("/rider-home", { state })
    } else {
      navigate("/dashboard", { state })
    }
  }

  return (
    <>
      {/* ── Help Button (only during active ride) ── */}
      {hasActiveRide && (
        <div ref={menuRef} style={{ position: "fixed", top: 16, right: 16, zIndex: 1000 }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              padding: "8px 14px",
              borderRadius: "12px",
              background: "#ffffff",
              border: "1px solid #64251dff",
              boxShadow: "0 2px 8px rgba(151, 34, 34, 0.05)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 15, color: "#d83434ff" }}>?</span>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#475569" }}>Help</span>
          </button>

          {/* ── Dropdown Menu ── */}
          {showMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "white",
                borderRadius: 16,
                padding: 8,
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                minWidth: 160,
                border: "1px solid #f1f5f9",
                animation: "scale-up 0.2s ease-out"
              }}
            >

              <button
                onClick={goToSupport}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 14px",
                  borderRadius: 10, background: "transparent", border: "none",
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  color: "#475569", fontWeight: 700, fontSize: 13
                }}
                className="hover:bg-slate-50"
              >
                <span></span><span></span>Report Issue
              </button>

              <button
                onClick={() => { setShowConfirm(true); setShowMenu(false) }}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 14px",
                  borderRadius: 10, background: "transparent", border: "none",
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  color: "#ef4444", fontWeight: 700, fontSize: 13
                }}
                className="hover:bg-red-50"
              >
                <span>❌</span>Cancel Ride
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Cancellation Confirmation Dialog ── */}
      {showConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, zIndex: 2000, backdropFilter: "blur(2px)"
        }}>
          <div style={{
            background: "white", borderRadius: 24, padding: 24, maxWidth: 360,
            width: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            animation: "modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
              Cancel Ride?
            </h3>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5, marginBottom: 24 }}>
              Are you sure you want to cancel the ride? Frequent cancellations will lead to account suspension.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={cancelling}
                style={{
                  flex: 1, padding: "14px", borderRadius: 14, border: "none",
                  background: "#f1f5f9", color: "#475569", fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                No
              </button>
              <button
                onClick={handleCancelClick}
                disabled={cancelling}
                style={{
                  flex: 1.2, padding: "14px", borderRadius: 14, border: "none",
                  background: "#d84646ff", color: "white", fontWeight: 500,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                {cancelling ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : "Cancel Ride"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cross-Party Cancellation Notification ── */}
      {cancellationAlert && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, zIndex: 2100, backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "white", borderRadius: 24, padding: 32, maxWidth: 400,
            width: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            textAlign: "center", animation: "modal-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
          }}>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <svg 
                fill="#ef4444" 
                width="64px" 
                height="64px" 
                viewBox="0 0 106.059 106.059"
                style={{ opacity: 0.9 }}
              >
                <g>
                  <path d="M90.546,15.518C69.858-5.172,36.199-5.172,15.515,15.513C-5.173,36.198-5.171,69.858,15.517,90.547
                    c20.682,20.684,54.341,20.684,75.027-0.004C111.23,69.858,111.229,36.2,90.546,15.518z M84.757,84.758
                    c-17.494,17.494-45.96,17.496-63.455,0.002c-17.498-17.497-17.496-45.966,0-63.46C38.796,3.807,67.261,3.805,84.759,21.302
                    C102.253,38.796,102.251,67.265,84.757,84.758z M77.017,74.001c0.658,1.521-0.042,3.286-1.562,3.943
                    c-1.521,0.66-3.286-0.042-3.944-1.562c-2.893-6.689-9.73-11.012-17.421-11.012c-7.868,0-14.747,4.319-17.522,11.004
                    c-0.479,1.154-1.596,1.851-2.771,1.851c-0.384,0-0.773-0.074-1.15-0.23c-1.53-0.636-2.255-2.392-1.62-3.921
                    c3.71-8.932,12.764-14.703,23.063-14.703C64.174,59.371,73.174,65.113,77.017,74.001z M33.24,38.671
                    c0-3.424,2.777-6.201,6.201-6.201c3.423,0,6.2,2.776,6.2,6.201c0,3.426-2.777,6.202-6.2,6.202
                    C36.017,44.873,33.24,42.097,33.24,38.671z M61.357,38.671c0-3.424,2.779-6.201,6.203-6.201c3.423,0,6.2,2.776,6.2,6.201
                    c0,3.426-2.776,6.202-6.2,6.202S61.357,42.097,61.357,38.671z"/>
                </g>
              </svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", marginBottom: 12 }}>
              {cancellationAlert.title}
            </h3>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, marginBottom: 28 }}>
              {cancellationAlert.message}
            </p>
            <button
              onClick={() => {
                setCancellationAlert(null)
                navigate(activeRideRole === "rider" ? "/rider-home" : "/dashboard")
              }}
              style={{
                width: "100%", padding: "16px", borderRadius: 16, border: "none",
                background: "#0f172a", color: "white", fontWeight: 500,
                cursor: "pointer", fontSize: 16
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Global Styles for Animations ── */}
      <style>{`
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.9) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}

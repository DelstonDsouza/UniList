// src/pages/passenger/PassengerPayment.jsx
// Full-page payment screen for passenger shown when ride:reached_destination
// Rating slides up from bottom as a 30% sheet after ride:completed

import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { socket } from "../../services/socket"
import { apiFetch } from "../../services/api"
import { useRide } from "../../context/RideContext"

export default function PassengerPayment() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const { resetToDiscovery } = useRide()

    const [rideData, setRideData] = useState(state || {})
    const { rideId, distanceKm, fare, riderName } = rideData

    useEffect(() => {
        if (!rideId) {
            apiFetch("/rides/active").then(data => {
                const r = data?.ride || data?.data?.ride
                if (r) {
                    setRideData({
                        rideId: r._id,
                        distanceKm: r.fare?.distanceKm || 0,
                        fare: r.fare?.amount || 0,
                        riderName: r.rider?.name || "Your Rider"
                    })
                } else {
                    // If backend says there's no active ride anymore, safely kick the user home
                    resetToDiscovery()
                    navigate("/dashboard", { replace: true })
                }
            }).catch(() => {})
        }
    }, [rideId, navigate, resetToDiscovery])

    const [showRating, setShowRating] = useState(false)
    const [ratingVal, setRatingVal] = useState(0)
    const [reviewText, setReviewText] = useState("")
    const [ratingSubmitting, setRatingSubmitting] = useState(false)
    const [ratingDone, setRatingDone] = useState(false)

    // Listen for ride:completed → slide up rating sheet
    useEffect(() => {
        if (!rideId) return
        const handleCompleted = () => setShowRating(true)
        socket.on("ride:completed", handleCompleted)

        // Fallback poll — in case socket event fired before this page mounted
        const poll = setInterval(async () => {
            try {
                const data = await apiFetch("/rides/active")
                const ride = data?.ride || data?.data?.ride
                if (!ride || ride.status === "completed") {
                    setShowRating(true)
                    clearInterval(poll)
                }
            } catch { /* ignore */ }
        }, 4000)

        return () => {
            socket.off("ride:completed", handleCompleted)
            clearInterval(poll)
        }
    }, [rideId])

    const goHome = () => {
        resetToDiscovery()
        navigate("/dashboard", { replace: true })
    }

    const handleSubmitRating = async () => {
        if (ratingVal === 0) return
        setRatingSubmitting(true)
        try {
            await apiFetch(`/rides/${rideId}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating: ratingVal, review: reviewText.trim() }),
            })
        } catch { /* skip silently */ }
        setRatingDone(true)
        setTimeout(goHome, 1400)
    }

    const displayFare = fare ?? "—"
    const displayDist = distanceKm ?? "—"

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(160deg, #f0fdf4 0%, #f1f5f9 60%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0",
            position: "relative",
            overflow: "hidden",
        }}>

            {/* Decorative circles */}
            <div style={{
                position: "absolute", top: -80, right: -80,
                width: 260, height: 260, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(22,163,74,0.10) 0%, transparent 70%)",
                pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute", bottom: -60, left: -60,
                width: 200, height: 200, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)",
                pointerEvents: "none",
            }} />

            {/* Main card */}
            <div style={{
                width: "100%", maxWidth: 420,
                margin: "0 auto",
                padding: "0 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}>
                {/* Icon */}
                <div style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36,
                    boxShadow: "0 8px 32px rgba(22,163,74,0.28)",
                    marginBottom: 20,
                }}>🎓</div>

                <p style={{
                    fontSize: 11, fontWeight: 800, color: "#16a34a",
                    letterSpacing: "0.14em", margin: "0 0 6px", textAlign: "center",
                }}>YOU'VE ARRIVED!</p>

                <h1 style={{
                    fontSize: 26, fontWeight: 900, color: "#0f172a",
                    margin: "0 0 28px", textAlign: "center", lineHeight: 1.2,
                }}>Please Pay the Rider</h1>

                {/* Fare card */}
                <div style={{
                    width: "100%", background: "white", borderRadius: 20,
                    padding: "20px 22px", marginBottom: 18,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span style={{ color: "#64748b", fontSize: 14 }}>Distance</span>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{displayDist} km</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span style={{ color: "#64748b", fontSize: 14 }}>Total Fare</span>
                        <span style={{ fontWeight: 900, fontSize: 26, color: "#16a34a" }}>₹{displayFare}</span>
                    </div>
                    <div style={{
                        borderTop: "1px solid #f1f5f9", paddingTop: 12,
                        display: "flex", alignItems: "center", gap: 8,
                    }}>
                        <span style={{ fontSize: 18 }}>💵</span>
                        <span style={{ color: "#64748b", fontSize: 13 }}>Payment Method:</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>Cash</span>
                    </div>
                </div>

                {/* Instruction */}
                <div style={{
                    background: "#f0fdf4", border: "1.5px solid #86efac",
                    borderRadius: 16, padding: "14px 18px",
                    width: "100%", textAlign: "center", marginBottom: 28,
                }}>
                    <p style={{ fontSize: 14, color: "#15803d", lineHeight: 1.6, margin: 0 }}>
                        Please hand <strong>₹{displayFare}</strong> in cash to{" "}
                        <strong>{riderName || "your rider"}</strong>.<br />
                        <span style={{ fontSize: 12, color: "#4ade80" }}>The rider will confirm once received.</span>
                    </p>
                </div>

                {/* Waiting indicator */}
                {!showRating && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#94a3b8", fontSize: 13 }}>
                        <div style={{
                            width: 16, height: 16, borderRadius: "50%",
                            border: "2.5px solid #16a34a", borderTopColor: "transparent",
                            animation: "spin 0.8s linear infinite",
                        }} />
                        Waiting for rider to confirm payment…
                    </div>
                )}
            </div>

            {/* ─── Rating bottom sheet ─── */}
            <div style={{
                position: "fixed",
                bottom: 0, left: 0, right: 0,
                height: showRating ? "auto" : "0px",
                maxHeight: showRating ? "55vh" : "0px",
                transition: "max-height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
                background: "white",
                borderRadius: "24px 24px 0 0",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.14)",
                overflow: "hidden",
                zIndex: 200,
            }}>
                <div style={{ padding: "18px 22px 32px" }}>
                    {/* Handle */}
                    <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 99, margin: "0 auto 18px" }} />

                    {ratingDone ? (
                        <div style={{ textAlign: "center", padding: "12px 0" }}>
                            <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
                            <p style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", margin: "0 0 4px" }}>
                                Thanks for your review!
                            </p>
                            <p style={{ fontSize: 13, color: "#94a3b8" }}>Heading back to home…</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                <div>
                                    <p style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: "0.10em", margin: "0 0 2px" }}>
                                        RATE YOUR RIDER
                                    </p>
                                    <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                                        {riderName || "Your Rider"}
                                    </h3>
                                </div>
                                <button onClick={goHome} style={{
                                    background: "none", border: "none", color: "#94a3b8",
                                    fontSize: 12, cursor: "pointer", textDecoration: "underline",
                                }}>Skip</button>
                            </div>

                            {/* Stars */}
                            <div style={{ display: "flex", justifyContent: "center", gap: 10, margin: "4px 0 14px" }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                    <button key={s} onClick={() => setRatingVal(s)} style={{
                                        fontSize: 36, background: "none", border: "none", cursor: "pointer",
                                        opacity: s <= ratingVal ? 1 : 0.22,
                                        transform: s <= ratingVal ? "scale(1.2)" : "scale(1)",
                                        transition: "all 0.15s",
                                        padding: 0,
                                    }}>⭐</button>
                                ))}
                            </div>

                            {/* Review textarea (optional) */}
                            <textarea
                                value={reviewText}
                                onChange={e => setReviewText(e.target.value)}
                                placeholder="Leave a comment (optional)…"
                                rows={2}
                                style={{
                                    width: "100%", borderRadius: 12, padding: "10px 14px",
                                    fontSize: 13, border: "1.5px solid #e2e8f0",
                                    outline: "none", resize: "none", fontFamily: "inherit",
                                    boxSizing: "border-box", marginBottom: 14,
                                    background: "#f8fafc", color: "#0f172a",
                                    transition: "border-color 0.2s",
                                }}
                                onFocus={e => e.target.style.borderColor = "#2563EB"}
                                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                            />

                            <button
                                onClick={handleSubmitRating}
                                disabled={ratingVal === 0 || ratingSubmitting}
                                style={{
                                    width: "100%", padding: "14px 0", borderRadius: 14,
                                    background: ratingVal === 0
                                        ? "#e2e8f0"
                                        : "linear-gradient(135deg,#2563EB,#1d4ed8)",
                                    color: ratingVal === 0 ? "#94a3b8" : "white",
                                    fontSize: 15, fontWeight: 800, border: "none",
                                    cursor: ratingVal === 0 ? "not-allowed" : "pointer",
                                    boxShadow: ratingVal > 0 ? "0 4px 18px rgba(37,99,235,0.28)" : "none",
                                    transition: "all 0.2s",
                                }}
                            >
                                {ratingSubmitting ? "Submitting…" : "⭐ Submit Review"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

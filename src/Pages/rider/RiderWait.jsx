// src/pages/rider/RiderWait.jsx
// Polls backend every 5s — when ride status = "locked", auto-navigates to RideConfirmed

import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { apiFetch } from "../../services/api"

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

export default function RiderWait() {
  const { id }       = useParams()
  const location     = useLocation()
  const navigate     = useNavigate()

  const {
    userLocation,
    collegeLocation,
    departureTime,
    departureTimeRaw,
  } = location.state || {}

  const [ride,             setRide]             = useState(null)
  const [dots,             setDots]             = useState("")
  const [showCancelPopup,  setShowCancelPopup]  = useState(false)
  const navigatedRef = useRef(false)

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 500)
    return () => clearInterval(t)
  }, [])

  // Poll ride status every 5s
  useEffect(() => {
    if (!id) return

    const poll = async () => {
      try {
        const data = await apiFetch(`/rides/my`)
        const rides = data?.data?.rides || []
        const current = rides.find(r => r._id === id)
        if (!current) return
        setRide(current)

        // When passenger accepts → navigate to RideConfirmed
        if (current.status === "locked" && !navigatedRef.current) {
          navigatedRef.current = true
          navigate("/ride-confirmed", {
            state: {
              rideId:           current._id,
              userLocation,
              collegeLocation,
              departureTime,
              departureTimeRaw,
              passengerName:    current.passenger?.name    || "Passenger",
              passengerPhone:   current.passenger?.phone   || "",
              passengerLat:     current.passenger?.location?.coordinates?.[1] || null,
              passengerLng:     current.passenger?.location?.coordinates?.[0] || null,
              fare:             current.fare?.amount       || 0,
              distanceKm:       current.fare?.distanceKm   || 0,
            },
          })
        }
      } catch (err) {
        console.error("Poll error:", err)
      }
    }

    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [id])

  const riderCoords =
    ride?.currentLocation?.coordinates
      ? [ride.currentLocation.coordinates[1], ride.currentLocation.coordinates[0]]
      : userLocation

  const passengerCoords =
    ride?.passenger?.location?.coordinates
      ? [ride.passenger.location.coordinates[1], ride.passenger.location.coordinates[0]]
      : null

  const passengerJoined = ride?.status === "locked"

  return (
    <div className="fixed inset-0 bg-white overflow-hidden">

      {/* CANCEL POPUP */}
      {showCancelPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-7 rounded-2xl shadow-xl text-center w-[90%] max-w-sm">
            <h2 className="text-xl font-semibold mb-3">Cancel the ride?</h2>
            <p className="text-gray-500 text-sm mb-6">This will remove your ride post.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelPopup(false)}
                className="flex-1 py-3 rounded-xl bg-gray-200 font-medium"
              >
                No
              </button>
              <button
                onClick={async () => {
                  try {
                    await apiFetch(`/rides/${id}/cancel`, { method: "POST" })
                  } catch {}
                  navigate("/rider-home", { replace: true })
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP STATUS */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-black/60 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 text-white text-center">
          <p className="text-sm font-semibold">
            {passengerJoined ? "Passenger found!" : `Looking for passengers${dots}`}
          </p>
          <p className="text-xs text-gray-300">Your ride is visible to nearby students</p>
        </div>
      </div>

      {/* MAP */}
      <div className="absolute top-0 left-0 right-0 h-[55vh] z-0">
        {riderCoords && (
          <MapContainer center={riderCoords} zoom={14} zoomControl={false}
            style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={riderCoords} />
            {passengerCoords && (
              <>
                <Marker position={passengerCoords} />
                <Polyline positions={[riderCoords, passengerCoords]}
                  pathOptions={{ color: "#4f7cff", weight: 5 }} />
              </>
            )}
          </MapContainer>
        )}
      </div>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-0 w-full px-5 pb-6 z-10">
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-lg space-y-5">

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Your trip</p>
            <p className="text-xs text-gray-400">Departure</p>
            <p className="font-semibold">{departureTime || "ASAP"}</p>
          </div>

          <div className="pt-3 border-t border-gray-100">
            {!passengerJoined ? (
              <>
                <p className="font-medium text-sm text-gray-700">No passengers yet</p>
                <p className="text-xs text-gray-400 mt-1">Searching nearby students{dots}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-green-600">✓ Passenger found!</p>
                <p className="text-sm text-gray-400 mt-1">
                  {ride?.passenger?.name} is waiting — taking you to confirmation…
                </p>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowCancelPopup(true)}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-red-500 font-medium"
            >
              Cancel Ride
            </button>
            <button
              disabled
              className="flex-1 py-3 rounded-xl bg-blue-400/40 text-white font-medium cursor-not-allowed"
            >
              Waiting{dots}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
// src/pages/passenger/RiderCard.jsx
// CREATE this new file
// Individual rider card shown in the discovery list

import { useState } from "react"
import toast from "react-hot-toast"
import { useRide } from "../../context/RideContext"

// Haversine for display distance (client-side only for UI label — server still enforces 3km)
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function RiderCard({ ride, passengerName, passengerPhone, onNameChange, onPhoneChange }) {
  const { requestRide, requestingRideId, userLocation } = useRide()
  const [confirming, setConfirming] = useState(false) // show confirm step

  const isRequesting = requestingRideId === ride._id

  const riderLat = ride.currentLocation?.coordinates?.[1]
  const riderLng = ride.currentLocation?.coordinates?.[0]

  const dist =
    userLocation && riderLat && riderLng
      ? distanceKm(userLocation[0], userLocation[1], riderLat, riderLng)
      : null

  const handleRequest = async () => {
    if (!passengerName.trim() || !passengerPhone.trim()) {
      toast.error("Enter your name and phone number above first")
      return
    }
    try {
      await requestRide(ride._id, passengerName, passengerPhone)
      // RideContext will switch viewState to "fare_reveal"
    } catch (err) {
      toast.error(err.message || "Failed to request ride")
      setConfirming(false)
    }
  }

  return (
    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
      {/* Top row: name + distance */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white text-base">
            {ride.riderName || "—"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {ride.vehicleNo || "—"} &bull; {ride.collegeName || "SJEC"}
          </p>
        </div>
        {dist !== null && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 whitespace-nowrap">
            📍 {dist.toFixed(1)} km
          </span>
        )}
      </div>

      {/* Phone */}
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        📞 {ride.riderPhone || "—"}
      </p>

      {/* Pickup location label */}
      {ride.pickupLocation?.coordinates && (
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          📌 Pickup:{" "}
          {ride.pickupLocation.coordinates[1].toFixed(5)},{" "}
          {ride.pickupLocation.coordinates[0].toFixed(5)}
        </p>
      )}

      {/* Fare warning */}
      <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-3">
        ⚠ Fare shown only after requesting. Cannot cancel once requested.
      </div>

      {/* Action */}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={isRequesting}
          className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          Request Ride
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 text-center">
            Confirm? This <span className="font-semibold text-red-500">cannot be undone</span>.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRequest}
              disabled={isRequesting}
              className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {isRequesting ? "Locking..." : "Yes, Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RiderCard
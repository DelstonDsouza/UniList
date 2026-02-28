// src/pages/passenger/ActiveRidePanel.jsx
// CREATE this new file
// Shown when viewState = "waiting" or "ongoing"
// Displays live rider location on map, fare chip, rider contact

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../../utils/leafletIcons"
import { useRide } from "../../context/RideContext"

function StatusBadge({ status }) {
  const config = {
    locked:  { label: "Rider is coming",  cls: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700" },
    ongoing: { label: "Ride in progress", cls: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700" },
  }
  const s = config[status] || config.locked
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${s.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {s.label}
    </span>
  )
}

function ActiveRidePanel() {
  const { activeRide, fareInfo, userLocation, viewState } = useRide()

  if (!activeRide) return null

  const riderLat = activeRide.currentLocation?.coordinates?.[1]
  const riderLng = activeRide.currentLocation?.coordinates?.[0]
  const pickupLat = activeRide.pickupLocation?.coordinates?.[1]
  const pickupLng = activeRide.pickupLocation?.coordinates?.[0]

  const mapCenter =
    riderLat && riderLng ? [riderLat, riderLng] : userLocation || [12.91, 74.85]

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your Ride</h2>
        <StatusBadge status={viewState === "ongoing" ? "ongoing" : "locked"} />
      </div>

      {/* Live Map */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-64">
        <MapContainer center={mapCenter} zoom={15} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Rider live position */}
          {riderLat && riderLng && (
            <Marker position={[riderLat, riderLng]}>
              <Popup>🛵 {activeRide.riderName} (live)</Popup>
            </Marker>
          )}

          {/* Pickup point */}
          {pickupLat && pickupLng && (
            <Marker position={[pickupLat, pickupLng]}>
              <Popup>📌 Pickup point</Popup>
            </Marker>
          )}

          {/* Passenger location */}
          {userLocation && (
            <Marker position={userLocation}>
              <Popup>📍 Your location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Rider card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base font-bold text-slate-700 dark:text-slate-300">
            {(activeRide.riderName || "R")[0]}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{activeRide.riderName}</p>
            <p className="text-xs text-slate-500">{activeRide.scooterNumber}</p>
          </div>
          <a
            href={`tel:${activeRide.riderPhone}`}
            className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition"
          >
            Call
          </a>
        </div>

        {/* Fare */}
        {fareInfo && (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">Your fare</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              ₹{fareInfo.amount}
              <span className="text-xs font-normal text-slate-400 ml-1">cash</span>
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-center text-slate-400">
        Map updates every 5 seconds &bull; Ride cannot be cancelled
      </p>
    </div>
  )
}

export default ActiveRidePanel
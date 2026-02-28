// src/pages/passenger/FareRevealSheet.jsx
// CREATE this new file
// Bottom-sheet modal that appears after ride lock — first and only time fare is shown

import { useRide } from "../../context/RideContext"

function FareRevealSheet() {
  const { fareInfo, activeRide, acknowledgeFare } = useRide()

  if (!fareInfo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 pb-8 sm:pb-6 z-10">
        {/* Handle bar (mobile) */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-6 sm:hidden" />

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center justify-center text-2xl mx-auto mb-4">
          🛵
        </div>

        <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-1">
          Ride Confirmed!
        </h2>
        <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">
          Your ride with {activeRide?.riderName || "the rider"} is locked.
        </p>

        {/* Fare breakdown */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Distance</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {fareInfo.distanceKm} km
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Rate</span>
            <span className="font-semibold text-slate-900 dark:text-white">₹5 / km</span>
          </div>
          <div className="h-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              Total Fare
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              ₹{fareInfo.amount}
            </span>
          </div>
          <p className="text-xs text-slate-400 text-center">Minimum fare ₹20 applies</p>
        </div>

        {/* Warning */}
        <div className="text-xs text-center text-red-500 dark:text-red-400 mb-5 px-2">
          ⚠ This ride cannot be cancelled. Pay cash directly to the rider on arrival.
        </div>

        {/* Rider info */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
            {(activeRide?.riderName || "R")[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {activeRide?.riderName || "—"}
            </p>
            <p className="text-xs text-slate-500">{activeRide?.scooterNumber || "—"}</p>
          </div>
          <a
            href={`tel:${activeRide?.riderPhone}`}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium"
          >
            Call
          </a>
        </div>

        <button
          onClick={acknowledgeFare}
          className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:opacity-90 transition"
        >
          Got it — Track Rider
        </button>
      </div>
    </div>
  )
}

export default FareRevealSheet
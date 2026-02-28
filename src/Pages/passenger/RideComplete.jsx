// src/pages/passenger/RideComplete.jsx
// CREATE this new file
// Shown when viewState = "completed"

import { useRide } from "../../context/RideContext"
import { useNavigate } from "react-router-dom"

function RideComplete() {
  const { activeRide, fareInfo, resetToDiscovery } = useRide()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Ride Complete!
      </h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
        Hope you had a smooth ride with {activeRide?.riderName || "your rider"}.
      </p>

      {fareInfo && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6 w-full max-w-xs">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Distance</span>
            <span className="font-medium text-slate-900 dark:text-white">{fareInfo.distanceKm} km</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount Paid</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">₹{fareInfo.amount}</span>
          </div>
        </div>
      )}

      <button
        onClick={resetToDiscovery}
        className="w-full max-w-xs py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:opacity-90 transition mb-3"
      >
        Book Another Ride
      </button>
      <button
        onClick={() => navigate("/")}
        className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
      >
        Go Home
      </button>
    </div>
  )
}

export default RideComplete
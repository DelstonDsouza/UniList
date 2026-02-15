import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { riderIcon, passengerIcon } from "../utils/leafletIconFix"
import { useParams } from "react-router-dom"
import { apiFetch } from "../lib/api"


export default function RiderWait() {

  // animated searching dots
  const [dots, setDots] = useState("")
  const [showPassengerPopup, setShowPassengerPopup] = useState(false)
  const [rideReady, setRideReady] = useState(false)
  const [showCancelPopup, setShowCancelPopup] = useState(false)


  const popupShownRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".")
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // ride id from URL
  const { id } = useParams()

  // ride data state
  const [ride, setRide] = useState(null)
  const [passengerJoined, setPassengerJoined] = useState(false)

  // load ride
  useEffect(() => {
    const loadRide = async () => {
      try {
        const res = await apiFetch(`/ride-offers/${id}`)
        const rideData = res.offer
        setRide(rideData)

        if (rideData?.status === "accepted") {
          setPassengerJoined(true)

          // show popup only once
          if (!popupShownRef.current) {
            popupShownRef.current = true
            setShowPassengerPopup(true)
          }
        }

      } catch (err) {
        console.error("Failed to load ride:", err)
      }
    }

    if (id) loadRide()
  }, [id])

  // poll passenger join
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/ride-offers/${id}`)
        const rideData = res.offer
        setRide(rideData)

        if (rideData?.status === "accepted") {
          setPassengerJoined(true)

          if (!popupShownRef.current) {
            popupShownRef.current = true
            setShowPassengerPopup(true)
          }
        }

      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [id])

  // coordinates safe
  const rider =
    ride && typeof ride.currentLat === "number" && typeof ride.currentLng === "number"
      ? [ride.currentLat, ride.currentLng]
      : null

  const passenger =
    ride && typeof ride.passengerLat === "number" && typeof ride.passengerLng === "number"
      ? [ride.passengerLat, ride.passengerLng]
      : null

  return (
    <div className="fixed inset-0 bg-white dark:bg-[#0b0b0c] text-black dark:text-white overflow-hidden">

      {/* PASSENGER FOUND POPUP */}
      {showPassengerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-[#111] p-8 rounded-2xl shadow-xl text-center w-[90%] max-w-sm">

            <div className="text-green-500 text-5xl mb-4">✔</div>

            <h2 className="text-xl font-semibold mb-2">
              Passenger Found
            </h2>

            <p className="text-gray-500 text-sm mb-6">
              Someone accepted your ride.
            </p>

            <button
              onClick={() => {
                setShowPassengerPopup(false)
                setRideReady(true)
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
            >
              Let’s Ride
            </button>
          </div>
        </div>
      )}
      {/* CANCEL RIDE POPUP */}
{showCancelPopup && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white dark:bg-[#111] p-7 rounded-2xl shadow-xl text-center w-[90%] max-w-sm">

      <h2 className="text-xl font-semibold mb-3">
        Cancel the ride?
      </h2>

      <p className="text-gray-500 text-sm mb-6">
        Are you sure you want to cancel this ride? This action cannot be undone.
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => setShowCancelPopup(false)}
          className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-white/10 font-medium"
        >
          No
        </button>

        <button
          onClick={async () => {
            try {
              await apiFetch(`/ride-offers/${id}/cancel`, { method: "POST" })
              window.location.href = "/dashboard"
            } catch {
              alert("Failed to cancel ride")
            }
          }}
          className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
        >
          Yes, Cancel
        </button>
      </div>
    </div>
  </div>
)}

      {/* TOP STATUS */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-black/60 backdrop-blur-md px-5 py-2 rounded-full border border-white/10">
          <p className="text-sm font-semibold">
            {passengerJoined ? "Passenger found" : `Looking for passengers${dots}`}
          </p>
          <p className="text-xs text-gray-300 text-center">
            Your ride is visible to nearby students
          </p>
        </div>
      </div>

      {/* MAP */}
      <div className="absolute top-0 left-0 right-0 h-[55vh] z-0">
        {rider && (
          <MapContainer
          center={rider}
          zoom={13}
          scrollWheelZoom={true}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
          >

            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker position={rider} icon={riderIcon} />

            {passengerJoined && passenger && (
              <>
                <Marker position={passenger} icon={passengerIcon} />
                <Polyline positions={[rider, passenger]} color="#4f7cff" weight={5} />
              </>
            )}
          </MapContainer>
        )}
      </div>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-0 w-full px-5 pb-6 z-10">
        <div className="bg-white dark:bg-[#111111] rounded-3xl p-6 border border-gray-200 dark:border-white/5 space-y-6">

          <div>
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Your trip</p>

            <div className="mb-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">Start</p>
              <p className="font-semibold text-base">
                {ride ? "Current location" : "Loading..."}
              </p>
            </div>

            <div className="mb-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">Destination</p>
              <p className="font-semibold text-base">
                {ride?.destination || "Loading..."}
              </p>
            </div>
          </div>

          {/* Passenger status */}
          <div className="pt-4 border-t border-gray-200 dark:border-white/10">
            {!passengerJoined ? (
              <>
                <p className="font-medium text-sm">No passengers yet</p>
                <p className="text-xs text-gray-500">Searching nearby students...</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-green-500">Passenger joined</p>
                <p className="text-sm text-gray-400">Ready to start ride</p>
              </>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
          
          {/* Cancel Ride Button*/}
            <button
             onClick={() => setShowCancelPopup(true)}
              className="flex-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-red-500 py-3 rounded-xl font-medium"
              > Cancel Ride </button>


            {/* Edit Ride Button*/}
            <button className="flex-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-medium">
              Edit
            </button>

             {/* Start Ride Button*/}
            <button
              disabled={!rideReady}
              onClick={async () => {
                try {
                  await apiFetch(`/ride-offers/${id}/start`, { method: "POST" })
                  window.location.href = `/ride-live/${id}`
                } catch {
                  alert("Failed to start ride")
                }
              }}
              className={`flex-1 py-3 rounded-xl font-medium transition ${
                rideReady
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-600/40 cursor-not-allowed"
              }`}
            >
              Start Ride
            </button>

          </div>

        </div>
      </div>

    </div>
  )
}

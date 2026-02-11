import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../utils/leafletIconFix"
import toast from "react-hot-toast"

function NewRide() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [offers, setOffers] = useState([])
  const [placeNames, setPlaceNames] = useState({})
  const [currentLoc, setCurrentLoc] = useState(null)
  const ride = useMemo(() => offers.find((o) => o.id === id), [offers, id])
  const [showPayment, setShowPayment] = useState(false)
  const [fareInfo, setFareInfo] = useState({ km: 0, price: 25 })

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setCurrentLoc([pos.coords.latitude, pos.coords.longitude])
    })
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const API = "http://localhost:8001"
        const res = await fetch(`${API}/ride-offers`)
        const data = await res.json()
        if (mounted) setOffers(data?.offers || [])
      } catch {
        /* ignore */
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const API = "http://localhost:8001"
        const res = await fetch(`${API}/ride-offers`)
        const data = await res.json()
        setOffers(data?.offers || [])
      } catch {
        /* ignore */
      }
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const fetchPlaceName = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      const data = await res.json()
      const name = data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      setPlaceNames((prev) => ({ ...prev, [`${lat},${lng}`]: name }))
    } catch {
      setPlaceNames((prev) => ({ ...prev, [`${lat},${lng}`]: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
    }
  }

  useEffect(() => {
    const keys = new Set()
    if (ride) {
      if (typeof ride.pickupLat === "number" && typeof ride.pickupLng === "number") {
        keys.add(`${ride.pickupLat},${ride.pickupLng}`)
      }
      if (typeof ride.currentLat === "number" && typeof ride.currentLng === "number") {
        keys.add(`${ride.currentLat},${ride.currentLng}`)
      }
      if (typeof ride.passengerLat === "number" && typeof ride.passengerLng === "number") {
        keys.add(`${ride.passengerLat},${ride.passengerLng}`)
      }
    }
    keys.forEach((k) => {
      if (!placeNames[k]) {
        const [lat, lng] = k.split(",").map(Number)
        fetchPlaceName(lat, lng)
      }
    })
  }, [ride, placeNames])

  const haversineKm = (aLat, aLng, bLat, bLng) => {
    const R = 6371
    const dLat = (Math.PI/180) * (bLat - aLat)
    const dLng = (Math.PI/180) * (bLng - aLng)
    const lat1 = (Math.PI/180) * aLat
    const lat2 = (Math.PI/180) * bLat
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
    return 2 * R * Math.asin(Math.sqrt(h))
  }
  const openPayment = () => {
    let km = 0
    if (ride && typeof ride.pickupLat === "number" && typeof ride.pickupLng === "number" && typeof ride.passengerLat === "number" && typeof ride.passengerLng === "number") {
      km = haversineKm(ride.pickupLat, ride.pickupLng, ride.passengerLat, ride.passengerLng)
    }
    const roundedKm = Math.max(0, Math.round(km))
    const price = 25 + roundedKm * 5
    setFareInfo({ km: roundedKm, price })
    setShowPayment(true)
  }
  const completeRide = async () => {
    try {
      const API = "http://localhost:8001"
      await fetch(`${API}/ride-offers/${id}/complete`, { method: "POST" })
      const res = await fetch(`${API}/ride-offers`)
      const data = await res.json()
      setOffers(data?.offers || [])
      toast.success("Payment recorded — ride completed")
      navigate("/dashboard")
    } catch {
      toast.error("Failed to complete ride")
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ride Details</h1>

        {!ride && (
          <div className="rounded-2xl border bg-white dark:bg-slate-900 p-6 text-slate-500">
            Loading ride...
          </div>
        )}

        {ride && (
          <>
            <section className="rounded-2xl border bg-white dark:bg-slate-900 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Passenger</h2>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="text-slate-700 dark:text-slate-300">
                  <div className="font-medium">Name</div>
                  <div>{ride.passengerName || "-"}</div>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <div className="font-medium">Phone</div>
                  <div>{ride.passengerPhone || "-"}</div>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <div className="font-medium">Pickup</div>
                  <div>
                    {typeof ride.pickupLat === "number" && typeof ride.pickupLng === "number"
                      ? (placeNames[`${ride.pickupLat},${ride.pickupLng}`] || `${ride.pickupLat.toFixed(5)}, ${ride.pickupLng.toFixed(5)}`)
                      : "-"}
                  </div>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <div className="font-medium">Current</div>
                  <div>
                    {typeof ride.currentLat === "number" && typeof ride.currentLng === "number"
                      ? (placeNames[`${ride.currentLat},${ride.currentLng}`] || `${ride.currentLat.toFixed(5)}, ${ride.currentLng.toFixed(5)}`)
                      : "-"}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border bg-white dark:bg-slate-900 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Live Map</h2>
              <div className="rounded-xl overflow-hidden border">
                <MapContainer
                  center={
                    typeof ride.currentLat === "number" && typeof ride.currentLng === "number"
                      ? [ride.currentLat, ride.currentLng]
                      : (currentLoc || [0, 0])
                  }
                  zoom={15}
                  style={{ height: 450 }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {typeof ride.currentLat === "number" && typeof ride.currentLng === "number" && (
                    <Marker position={[ride.currentLat, ride.currentLng]}>
                      <Popup>Rider Live</Popup>
                    </Marker>
                  )}
                  {typeof ride.pickupLat === "number" && typeof ride.pickupLng === "number" && (
                    <Marker position={[ride.pickupLat, ride.pickupLng]}>
                      <Popup>Pickup Point</Popup>
                    </Marker>
                  )}
                  {typeof ride.passengerLat === "number" && typeof ride.passengerLng === "number" && (
                    <Marker position={[ride.passengerLat, ride.passengerLng]}>
                      <Popup>Passenger</Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
                  onClick={openPayment}
                >
                  Location Reached
                </button>
              </div>
            </section>
          </>
        )}
      </div>
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowPayment(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 z-10">
            <h3 className="text-lg font-bold mb-2">Payment</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Distance: {fareInfo.km} km
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Total fare: ₹{fareInfo.price}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800" onClick={() => setShowPayment(false)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-green-600 text-white" onClick={completeRide}>Cash Received</button>
              <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white" onClick={() => { toast.success("Razorpay payment simulated"); completeRide() }}>Pay with Razorpay</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default NewRide

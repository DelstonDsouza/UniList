import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../utils/leafletIconFix"

function Dashboard() {
  const [active, setActive] = useState("have")
  const [accepting, setAccepting] = useState(null)
  const [offers, setOffers] = useState([])
  const [currentLoc, setCurrentLoc] = useState(null)
  const [passengerLoc, setPassengerLoc] = useState(null)
  const [passengerForm, setPassengerForm] = useState({
    passengerName: "",
    passengerPhone: "",
  })
  const [placeNames, setPlaceNames] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:8000/ride-offers")
        const data = await res.json()
        setOffers(data?.offers || [])
      } catch (e) { console.error(e) }
    })()
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
    offers.forEach((o) => {
      if (typeof o.pickupLat === "number" && typeof o.pickupLng === "number") {
        keys.add(`${o.pickupLat},${o.pickupLng}`)
      }
      if (typeof o.currentLat === "number" && typeof o.currentLng === "number") {
        keys.add(`${o.currentLat},${o.currentLng}`)
      }
      if (typeof o.passengerLat === "number" && typeof o.passengerLng === "number") {
        keys.add(`${o.passengerLat},${o.passengerLng}`)
      }
    })
    if (currentLoc) keys.add(`${currentLoc[0]},${currentLoc[1]}`)
    if (passengerLoc) keys.add(`${passengerLoc[0]},${passengerLoc[1]}`)
    keys.forEach((k) => {
      if (!placeNames[k]) {
        const [lat, lng] = k.split(",").map(Number)
        fetchPlaceName(lat, lng)
      }
    })
  }, [offers, currentLoc, passengerLoc, placeNames])

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = [pos.coords.latitude, pos.coords.longitude]
      setCurrentLoc(loc)
    })
  }, [])

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r p-6">
        <h2 className="text-2xl font-extrabold mb-10 text-slate-900 dark:text-white">
          Kozhi<span className="text-blue-600">Go</span>
        </h2>

        <button
          onClick={() => setActive("have")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition mb-3
          ${active === "have"
            ? "bg-blue-600 text-white shadow"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          🚕 Book a Ride
        </button>

        <button
          onClick={() => navigate("/giveride")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          🚲 Give a Ride
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-8">
        {active === "have" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
                Available Rides
              </h3>
              {offers.length === 0 && (
                <div className="text-sm text-slate-500">No rides available</div>
              )}
              <ul className="space-y-4">
                {offers.map((o) => (
                  <li key={o.id} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{o.riderName || "-"}</p>
                        <p className="text-sm text-slate-500">{o.scooterNumber} • {o.collegeName}</p>
                        <p className="text-sm text-slate-500">📞 {o.phone}</p>
                        <p className="text-xs text-slate-400">
                          Pickup: {typeof o.pickupLat === "number" && typeof o.pickupLng === "number"
                            ? (placeNames[`${o.pickupLat},${o.pickupLng}`] || `${o.pickupLat.toFixed(5)}, ${o.pickupLng.toFixed(5)}`)
                            : "-"}
                        </p>
                        <p className="text-xs text-slate-400">
                          Current: {typeof o.currentLat === "number" && typeof o.currentLng === "number"
                            ? (placeNames[`${o.currentLat},${o.currentLng}`] || `${o.currentLat.toFixed(5)}, ${o.currentLng.toFixed(5)}`)
                            : "-"}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium
                          ${(o.status || "pending") === "active"
                            ? "bg-green-600 text-white"
                            : (o.status || "pending") === "rejected"
                            ? "bg-red-600 text-white"
                            : "bg-yellow-500 text-white"}`}
                      >
                        {o.status || "pending"}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className={`px-3 py-1 text-xs rounded-lg ${o.status === "pending" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-slate-400 text-slate-800 cursor-not-allowed"}`}
                        disabled={o.status !== "pending"}
                        onClick={() => {
                          if (o.status !== "pending") {
                            toast.error("This ride status is finalized")
                            return
                          }
                          setAccepting(o.id)
                          setPassengerForm({ passengerName: "", passengerPhone: "" })
                          setPassengerLoc(currentLoc)
                        }}
                      >
                        Accept
                      </button>
                      <button
                        className={`px-3 py-1 text-xs rounded-lg ${o.status === "pending" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-slate-400 text-slate-800 cursor-not-allowed"}`}
                        disabled={o.status !== "pending"}
                        onClick={async () => {
                          if (o.status !== "pending") {
                            toast.error("This ride status is finalized")
                            return
                          }
                          await fetch(`http://localhost:8000/ride-offers/${o.id}/reject`, { method: "POST" })
                          const res = await fetch("http://localhost:8000/ride-offers")
                          const data = await res.json()
                          setOffers(data?.offers || [])
                          toast.success("Ride rejected")
                        }}
                      >
                        Reject
                      </button>
                      
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
                Your Location & Confirm
              </h3>
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Your Name"
                  value={passengerForm.passengerName}
                  onChange={(e) => setPassengerForm({ ...passengerForm, passengerName: e.target.value })}
                  required
                />
                <input
                  className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Your Phone"
                  value={passengerForm.passengerPhone}
                  onChange={(e) => setPassengerForm({ ...passengerForm, passengerPhone: e.target.value })}
                  required
                />
                <div className="rounded-xl overflow-hidden border">
                  {passengerLoc && (
                    <MapContainer
                      center={passengerLoc}
                      zoom={15}
                      style={{ height: 250 }}
                      whenCreated={(map) => {
                        map.on("click", (e) => {
                          setPassengerLoc([e.latlng.lat, e.latlng.lng])
                        })
                      }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={passengerLoc}>
                        <Popup>Your Location</Popup>
                      </Marker>
                    </MapContainer>
                  )}
                </div>
                <button
                  disabled={!accepting}
                  className={`w-full py-2 rounded-xl font-semibold ${accepting ? "bg-blue-600 text-white" : "bg-slate-400 text-slate-800"}`}
                  onClick={async () => {
                    if (!accepting) return
                    const selected = offers.find((x) => x.id === accepting)
                    if (!selected || (selected.status || "pending") !== "pending") {
                      toast.error("This ride status is finalized")
                      setAccepting(null)
                      return
                    }
                    if (!passengerForm.passengerName.trim() || !passengerForm.passengerPhone.trim()) {
                      toast.error("Enter passenger name and phone")
                      return
                    }
                    if (!passengerLoc) {
                      toast.error("Select your location on the map")
                      return
                    }
                    const t = toast.loading("Accepting ride...")
                    await fetch(`http://localhost:8000/ride-offers/${accepting}/accept`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        passengerName: passengerForm.passengerName,
                        passengerPhone: passengerForm.passengerPhone,
                        passengerLat: passengerLoc ? passengerLoc[0] : null,
                        passengerLng: passengerLoc ? passengerLoc[1] : null,
                      }),
                    })
                    setAccepting(null)
                    const res = await fetch("http://localhost:8000/ride-offers")
                    const data = await res.json()
                    setOffers(data?.offers || [])
                    toast.success("Ride accepted", { id: t })
                  }}
                >
                  Confirm Accept
                </button>
              </div>
            </div>
          </div>
        )}

        

        
      </main>
    </div>
  )
}

export default Dashboard

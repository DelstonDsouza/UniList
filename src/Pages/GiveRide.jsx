import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../utils/leafletIconFix"

function GiveRide() {
  const navigate = useNavigate()
  const [offers, setOffers] = useState([])
  const [isApproved, setIsApproved] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [approvalChecked, setApprovalChecked] = useState(false)
  const [offerForm, setOfferForm] = useState({
    riderName: "",
    scooterNumber: "",
    phone: "",
    collegeName: "",
  })
  const [currentLoc, setCurrentLoc] = useState({ lat: 11.0168, lng: 76.9558 })
  const [pickupPoint, setPickupPoint] = useState(null)
  const [placeNames, setPlaceNames] = useState({})

  const hasBlockingRide = useMemo(() => {
    return offers.some((o) => ["active", "ongoing"].includes(o.status))
  }, [offers])

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    )
  }, [])

  // check rider approval status for current user
  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const user = (await import("../firebase")).auth.currentUser
        const token = user ? await user.getIdToken() : null
        if (!token) {
          if (mounted) { setIsApproved(false); setApprovalChecked(true) }
          return
        }
        const API = "http://localhost:8001"
        const res = await fetch(`${API}/rider-approval/mine`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        const approval = data?.approval || null
        const resUser = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
        const dataUser = await resUser.json()
        if (mounted) {
          setIsApproved(approval && approval.status === "approved")
          setIsVerified(!!dataUser?.user?.verified)
          setApprovalChecked(true)
        }
      } catch {
        if (mounted) { setIsApproved(false); setIsVerified(false); setApprovalChecked(true) }
      }
    }
    check()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const res = await fetch("http://localhost:8000/ride-offers")
      const data = await res.json()
      if (!mounted) return
      setOffers(data?.offers || [])
    }
    load()
    const t = setInterval(load, 5000)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  const fetchPlaceName = async (lat, lng) => {
    const key = `${lat},${lng}`
    if (placeNames[key]) return
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const data = await res.json()
      const name = data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      setPlaceNames((p) => ({ ...p, [key]: name }))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    const coords = []
    if (pickupPoint && typeof pickupPoint.lat === "number" && typeof pickupPoint.lng === "number") {
      coords.push([pickupPoint.lat, pickupPoint.lng])
    }
    if (typeof currentLoc.lat === "number" && typeof currentLoc.lng === "number") {
      coords.push([currentLoc.lat, currentLoc.lng])
    }
    offers.forEach((o) => {
      if (typeof o.pickupLat === "number" && typeof o.pickupLng === "number") {
        coords.push([o.pickupLat, o.pickupLng])
      }
      if (typeof o.currentLat === "number" && typeof o.currentLng === "number") {
        coords.push([o.currentLat, o.currentLng])
      }
      if (typeof o.passengerLat === "number" && typeof o.passengerLng === "number") {
        coords.push([o.passengerLat, o.passengerLng])
      }
    })
    coords.forEach(([lat, lng]) => fetchPlaceName(lat, lng))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, pickupPoint, currentLoc])

  const onMapClick = (e) => {
    const { lat, lng } = e.latlng
    setPickupPoint({ lat, lng })
  }

  const postOffer = async () => {
    if (!approvalChecked) {
      toast.error("Checking approval status — try again shortly")
      return
    }
    if (!isApproved || !isVerified) {
      toast.error("Only approved and verified riders can post rides. Submit approval and wait for admin verification.")
      return
    }
    if (!offerForm.riderName || !offerForm.scooterNumber || !offerForm.phone || !offerForm.collegeName || !pickupPoint) {
      toast.error("Fill all fields and pick pickup point")
      return
    }
    if (hasBlockingRide) {
      toast.error("Complete current ride before posting a new one")
      return
    }
    setShowFareInfo(true)
  }

  const [showFareInfo, setShowFareInfo] = useState(false)

  const confirmPostOffer = async () => {
    const payload = {
      ...offerForm,
      pickupLat: pickupPoint.lat,
      pickupLng: pickupPoint.lng,
      currentLat: currentLoc.lat,
      currentLng: currentLoc.lng,
    }
    const t = toast.loading("Posting ride...")
    const API = "http://localhost:8001"
    await fetch(`${API}/ride-offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const res = await fetch(`${API}/ride-offers`)
    const data = await res.json()
    setOffers(data?.offers || [])
    toast.success("Ride posted", { id: t })
    setOfferForm({ riderName: "", scooterNumber: "", phone: "", collegeName: "" })
    setPickupPoint(null)
    setShowFareInfo(false)
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Post a Ride</h2>
          {!approvalChecked ? (
            <div className="mb-3 text-sm text-slate-500">Checking rider approval status...</div>
          ) : !isApproved ? (
            <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-yellow-100 text-yellow-900">
              You are not an approved rider yet — <a className="underline text-blue-600" href="/rider-approval">submit approval</a> and wait for admin acceptance.
            </div>
          ) : null}
          {hasBlockingRide && (
            <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-yellow-100 text-yellow-900">
              You have an active/ongoing ride. Complete it before posting a new one.
            </div>
          )}
          <div className="space-y-3 mb-4">
            <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Rider Name" value={offerForm.riderName} onChange={(e) => setOfferForm((f) => ({ ...f, riderName: e.target.value }))} disabled={hasBlockingRide} />
            <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Scooter Number" value={offerForm.scooterNumber} onChange={(e) => setOfferForm((f) => ({ ...f, scooterNumber: e.target.value }))} disabled={hasBlockingRide} />
            <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Phone" value={offerForm.phone} onChange={(e) => setOfferForm((f) => ({ ...f, phone: e.target.value }))} disabled={hasBlockingRide} />
            <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="College Name" value={offerForm.collegeName} onChange={(e) => setOfferForm((f) => ({ ...f, collegeName: e.target.value }))} disabled={hasBlockingRide} />
          </div>
          <div className="mb-4">
            <div className="text-sm mb-2 text-slate-700 dark:text-slate-300">Pick your pickup point on map</div>
            <div className="h-64 rounded-xl overflow-hidden border">
              <MapContainer center={[currentLoc.lat, currentLoc.lng]} zoom={14} style={{ height: "100%", width: "100%" }} whenCreated={(map) => map.on("click", onMapClick)}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[currentLoc.lat, currentLoc.lng]}>
                  <Popup>Current Location</Popup>
                </Marker>
                {pickupPoint && (
                  <Marker position={[pickupPoint.lat, pickupPoint.lng]}>
                    <Popup>Pickup Point</Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Pickup: {pickupPoint ? (placeNames[`${pickupPoint.lat},${pickupPoint.lng}`] || `${pickupPoint.lat.toFixed(5)}, ${pickupPoint.lng.toFixed(5)}`) : "-"}
            </div>
          </div>
          <button className={`w-full py-2 rounded-xl font-semibold ${hasBlockingRide ? "bg-slate-400 text-slate-800 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"}`} disabled={hasBlockingRide} onClick={postOffer}>
            {hasBlockingRide ? "Blocked by active ride" : "Post Ride"}
          </button>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Posted Rides</h2>
          {offers.length === 0 && (
            <div className="text-sm text-slate-500">No rides posted yet</div>
          )}
          <ul className="space-y-4">
            {offers.map((o) => (
              <li key={o.id} className="flex justify-between items-start gap-4 p-4 rounded-xl bg-slate-100 dark:bg-slate-800">
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
                  {o.passengerName && (
                    <p className="text-sm text-slate-500">
                      Passenger: {o.passengerName} • {o.passengerPhone || "-"}
                    </p>
                  )}
                  {typeof o.passengerLat === "number" && typeof o.passengerLng === "number" && (
                    <p className="text-xs text-slate-400">
                      Passenger Loc: {placeNames[`${o.passengerLat},${o.passengerLng}`] || `${o.passengerLat.toFixed(5)}, ${o.passengerLng.toFixed(5)}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium
                    ${(o.status || "pending") === "active"
                      ? "bg-green-600 text-white"
                      : (o.status || "pending") === "rejected"
                      ? "bg-red-600 text-white"
                      : (o.status || "pending") === "ongoing"
                      ? "bg-blue-600 text-white"
                      : (o.status || "pending") === "completed"
                      ? "bg-slate-500 text-white"
                      : "bg-yellow-500 text-white"}`}>
                    {o.status || "pending"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className={`px-3 py-1 text-xs rounded-lg ${o.status === "pending" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-slate-400 text-slate-800 cursor-not-allowed"}`}
                      disabled={o.status !== "pending"}
                      onClick={async () => {
                        if (o.status !== "pending") {
                          toast.error("This ride status is finalized")
                          return
                        }
                        await fetch(`http://localhost:8000/ride-offers/${o.id}/status`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "active" }),
                        })
                        const res = await fetch("http://localhost:8000/ride-offers")
                        const data = await res.json()
                        setOffers(data?.offers || [])
                        toast.success("Ride activated")
                      }}
                    >
                      Activate
                    </button>
                    <button
                      className={`px-3 py-1 text-xs rounded-lg ${o.status === "pending" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-slate-400 text-slate-800 cursor-not-allowed"}`}
                      disabled={o.status !== "pending"}
                      onClick={async () => {
                        if (o.status !== "pending") {
                          toast.error("This ride status is finalized")
                          return
                        }
                        await fetch(`http://localhost:8000/ride-offers/${o.id}/status`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "rejected" }),
                        })
                        const res = await fetch("http://localhost:8000/ride-offers")
                        const data = await res.json()
                        setOffers(data?.offers || [])
                        toast.success("Ride rejected")
                      }}
                    >
                      Reject
                    </button>
                    {o.status === "active" && (
                      <button
                        className="px-3 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={async () => {
                          try {
                            await fetch(`http://localhost:8000/ride-offers/${o.id}/start`, { method: "POST" })
                            const res = await fetch("http://localhost:8000/ride-offers")
                            const data = await res.json()
                            setOffers(data?.offers || [])
                            navigate(`/new-ride/${o.id}`)
                          } catch (e) { console.error(e) }
                        }}
                      >
                        Start Ride
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {showFareInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowFareInfo(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 z-10">
            <h3 className="text-lg font-bold mb-2">Fare Policy</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Minimum fare is ₹25. Additional ₹5 per km applies for distance traveled.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Final price is calculated after trip completion based on actual kilometers.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800" onClick={() => setShowFareInfo(false)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={confirmPostOffer}>Confirm & Post</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default GiveRide

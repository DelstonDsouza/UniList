import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../../utils/leafletIcons"
import { apiFetch } from "../../services/api"


function GiveRide() {
  const navigate = useNavigate()
  const [offers, setOffers] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)

  const [currentLoc, setCurrentLoc] = useState({ lat: 11.0168, lng: 76.9558 })
  const [pickupPoint, setPickupPoint] = useState(null)
  const [placeNames, setPlaceNames] = useState({})
  const [destination, setDestination] = useState("")
  const [departureTime, setDepartureTime] = useState("")
  const [saveForFuture, setSaveForFuture] = useState(false)
  const [pickupLater, setPickupLater] = useState(false)
  const [isPickupCurrent, setIsPickupCurrent] = useState(false)
  const [pickupQuery, setPickupQuery] = useState("")
  const [destinationQuery, setDestinationQuery] = useState("")
  const [pickupSuggestions, setPickupSuggestions] = useState([])
  const [destinationSuggestions, setDestinationSuggestions] = useState([])
  const [destinationLatLng, setDestinationLatLng] = useState(null)
  const [destinationSelected, setDestinationSelected] = useState(false)
  const [leafletMap, setLeafletMap] = useState(null)
  const [routeCoords, setRouteCoords] = useState([])
  const [routeKm, setRouteKm] = useState(null)
  const [routeEtaMin, setRouteEtaMin] = useState(null)

  const hasBlockingRide = useMemo(() => {
    return offers.some((o) => ["active", "ongoing"].includes(o.status))
  }, [offers])

  useEffect(() => {
    const raw = localStorage.getItem("user")
    const u = raw ? JSON.parse(raw) : null
    const isRider = !!u && !!u.isRider
    if (!isRider) navigate("/become-rider")
  }, [navigate])

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { },
      { enableHighAccuracy: true }
    )
  }, [])



  useEffect(() => {
    setOffers([])
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

  const searchPlaces = async (q) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`
    const res = await fetch(url)
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map((x) => ({
      display: x.display_name,
      lat: parseFloat(x.lat),
      lng: parseFloat(x.lon),
    }))
  }

  useEffect(() => {
    const h = setTimeout(async () => {
      if (pickupQuery && pickupQuery.length > 2 && !pickupLater && !isPickupCurrent) {
        const results = await searchPlaces(pickupQuery)
        setPickupSuggestions(results)
      } else {
        setPickupSuggestions([])
      }
    }, 300)
    return () => clearTimeout(h)
  }, [pickupQuery, pickupLater, isPickupCurrent])

  useEffect(() => {
    const h = setTimeout(async () => {
      if (destinationQuery && destinationQuery.length > 2 && !destinationSelected) {
        const results = await searchPlaces(destinationQuery)
        setDestinationSuggestions(results)
      } else {
        setDestinationSuggestions([])
      }
    }, 300)
    return () => clearTimeout(h)
  }, [destinationQuery, destinationSelected])
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
    setIsPickupCurrent(false)
    setPickupLater(false)
    setPickupQuery(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    fetchPlaceName(lat, lng)
  }

  useEffect(() => {
    const origin = pickupPoint
      ? { lat: pickupPoint.lat, lng: pickupPoint.lng }
      : (currentLoc && (isPickupCurrent || pickupLater) ? { lat: currentLoc.lat, lng: currentLoc.lng } : null)
    const dest = destinationLatLng
    let canceled = false
    const run = async () => {
      if (!origin || !dest) {
        setRouteCoords([])
        setRouteKm(null)
        setRouteEtaMin(null)
        return
      }
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`
        const res = await fetch(url)
        const data = await res.json()
        const route = data?.routes?.[0]
        if (!route || canceled) return
        const coords = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng])
        const km = (route.distance || 0) / 1000
        const etaMin = Math.round((km / 40) * 60)
        setRouteCoords(coords)
        setRouteKm(km)
        setRouteEtaMin(etaMin)
      } catch {
        setRouteCoords([])
        setRouteKm(null)
        setRouteEtaMin(null)
      }
    }
    run()
    return () => { canceled = true }
  }, [pickupPoint, currentLoc, isPickupCurrent, pickupLater, destinationLatLng])
  const postOffer = async () => {
    if ((!pickupPoint && !pickupLater) || !destination || !departureTime) {
      toast.error("Select pickup or choose Later, add destination and time")
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
    const u = JSON.parse(localStorage.getItem("user") || "{}")

    const payload = {
      currentLat: currentLoc.lat,
      currentLng: currentLoc.lng,
      destination,
      departureTime,
      pickupLater,
      ...(pickupPoint
        ? { pickupLat: pickupPoint.lat, pickupLng: pickupPoint.lng }
        : {})
    }

    const t = toast.loading("Posting ride...")

    try {
      const created = await apiFetch("/ride-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const offerId = created?.offer?.id || created?.offer?._id

      toast.success("Ride posted", { id: t })

      if (offerId) navigate(`/rider-wait/${offerId}`)

    } catch {
      toast.error("Failed to post ride", { id: t })
    }

    setPickupPoint(null)

    if (saveForFuture) {
      const saved = {
        destination,
        departureTime,
        pickupLat: payload.pickupLat,
        pickupLng: payload.pickupLng,
      }
      localStorage.setItem("savedRide", JSON.stringify(saved))
    }

    setDestination("")
    setDestinationQuery("")
    setDepartureTime("")
    setSaveForFuture(false)
    setPickupLater(false)
    setPickupQuery("")
    setIsPickupCurrent(false)
    setPickupSuggestions([])
    setDestinationSuggestions([])
    setDestinationLatLng(null)
    setShowFareInfo(false)
  }


  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
      {/* Menu trigger */}
      <button
        className="fixed left-4 top-4 z-50 p-3 rounded-xl bg-white dark:bg-slate-800 border shadow hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Open menu"
      >
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white mb-1"></span>
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white mb-1"></span>
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white"></span>
      </button>

      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 px-6 pt-16 pb-6">
            <h2 className="text-2xl font-extrabold mb-6 text-white">
              Menu
            </h2>
            <div className="space-y-0 divide-y divide-slate-700">
              <button
                onClick={() => { setMenuOpen(false); navigate("/dashboard") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                PASSENGER
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  const raw = localStorage.getItem("user")
                  const u = raw ? JSON.parse(raw) : null
                  const has = !!u && !!u.isRider
                  navigate(has ? "/giveride" : "/become-rider")
                }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                RIDER
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("History coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                HISTORY
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("Contact coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                CONTACT
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("Profile coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                PROFILE
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  localStorage.removeItem("user")
                  localStorage.removeItem("isRider")
                  localStorage.removeItem("riderProfile")
                  localStorage.removeItem("token")
                  navigate("/login")
                }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                LOGOUT
              </button>

            </div>
          </aside>
        </div>
      )}
      <div className="max-w-4xl mx-auto">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Post a Ride</h2>
            {hasBlockingRide && (
              <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-yellow-100 text-yellow-900">
                You have an active/ongoing ride. Complete it before posting a new one.
              </div>
            )}
          </div>
          <div className="h-72 sm:h-96 border-t relative">
            <MapContainer
              center={[currentLoc.lat, currentLoc.lng]}
              zoom={14}
              style={{ height: "100%", width: "100%" }}
              whenCreated={(map) => { setLeafletMap(map); map.on("click", onMapClick) }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[currentLoc.lat, currentLoc.lng]}>
                <Popup>Current Location</Popup>
              </Marker>
              {pickupPoint && (
                <Marker position={[pickupPoint.lat, pickupPoint.lng]}>
                  <Popup>Pickup Point</Popup>
                </Marker>
              )}
              {routeCoords.length > 0 && (
                <Polyline positions={routeCoords} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9 }} />
              )}
            </MapContainer>
            {routeKm != null && routeEtaMin != null && (
              <div className="absolute top-4 right-4 bg-white dark:bg-slate-900 border rounded-full shadow px-3 py-2 text-sm font-semibold flex items-center gap-2">
                <span>{routeKm.toFixed(1)} km</span>
                <span className="text-slate-400">•</span>
                <span>{routeEtaMin} min</span>
              </div>
            )}
          </div>
          <div className="p-6 space-y-3">
            <div className="relative">
              <div className="flex items-center justify-between rounded-xl border px-4 py-3 bg-white dark:bg-slate-950">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-green-600">●</span>
                  {isPickupCurrent ? (
                    <div className="text-slate-900 dark:text-white">Current location</div>
                  ) : (
                    <input
                      className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white"
                      placeholder="Enter pickup location"
                      value={pickupQuery}
                      onChange={(e) => { setPickupQuery(e.target.value); setPickupPoint(null) }}
                      disabled={hasBlockingRide || pickupLater}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-2 py-1 rounded-lg border"
                    onClick={() => {
                      setIsPickupCurrent(true)
                      setPickupLater(false)
                      setPickupPoint({ lat: currentLoc.lat, lng: currentLoc.lng })
                      fetchPlaceName(currentLoc.lat, currentLoc.lng)
                      if (leafletMap) {
                        leafletMap.setView([currentLoc.lat, currentLoc.lng], 15, { animate: true })
                      }
                    }}
                    disabled={hasBlockingRide}
                    title="Use current"
                  >
                    ●
                  </button>
                  <button
                    className={`text-sm font-semibold ${pickupLater ? "text-blue-700" : "text-blue-600"} hover:text-blue-700`}
                    onClick={() => { setPickupLater((v) => !v); if (!pickupLater) { setIsPickupCurrent(false); setPickupPoint(null) } }}
                    disabled={hasBlockingRide}
                  >
                    Later
                  </button>
                </div>
              </div>
              {pickupSuggestions.length > 0 && !isPickupCurrent && !pickupLater && (
                <div className="absolute left-0 right-0 mt-2 rounded-xl border bg-white dark:bg-slate-900 shadow z-10">
                  {pickupSuggestions.map((s, i) => (
                    <button
                      key={`${s.lat}-${s.lng}-${i}`}
                      className="block w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => {
                        setPickupPoint({ lat: s.lat, lng: s.lng })
                        setPickupQuery(s.display)
                        setIsPickupCurrent(false)
                        setPickupLater(false)
                        setPickupSuggestions([])
                      }}
                    >
                      <div className="text-sm text-slate-900 dark:text-white">{s.display}</div>
                      <div className="text-xs text-slate-500">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-xl border px-4 py-3 bg-white dark:bg-slate-950 relative">
              <span>🎓</span>
              <input
                className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white"
                placeholder="Enter destination"
                value={destinationQuery}
                onChange={(e) => { setDestinationQuery(e.target.value); setDestination(e.target.value); setDestinationSelected(false) }}
                disabled={hasBlockingRide}
              />
              {destinationSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border bg-white dark:bg-slate-900 shadow z-10">
                  {destinationSuggestions.map((s, i) => (
                    <button
                      key={`${s.lat}-${s.lng}-${i}`}
                      className="block w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => {
                        setDestination(s.display)
                        setDestinationQuery(s.display)
                        setDestinationLatLng({ lat: s.lat, lng: s.lng })
                        setDestinationSelected(true)
                        setDestinationSuggestions([])
                      }}
                    >
                      <div className="text-sm text-slate-900 dark:text-white">{s.display}</div>
                      <div className="text-xs text-slate-500">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border px-4 py-3 bg-white dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <span>🕒</span>
                <div className="text-slate-900 dark:text-white">Departure time</div>
              </div>
              <input
                type="time"
                className="rounded-lg px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                disabled={hasBlockingRide}
              />
            </div>

            <div className="rounded-xl border px-4 py-3 bg-white dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-blue-600">✔️</span>
                  <div className="text-slate-900 dark:text-white font-medium">Save this ride for future?</div>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={saveForFuture} onChange={(e) => setSaveForFuture(e.target.checked)} disabled={hasBlockingRide} />
                  <span className="w-11 h-6 bg-slate-300 peer-checked:bg-blue-600 rounded-full relative transition">
                    <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:left-6"></span>
                  </span>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-2">Save your ride to use for next time.</p>
            </div>

            <button
              className={`w-full py-3 rounded-xl font-semibold text-white ${hasBlockingRide ? "bg-slate-400 text-slate-800 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
              disabled={hasBlockingRide}
              onClick={postOffer}
            >
              {hasBlockingRide ? "Blocked by active ride" : "Find Passenger"}
            </button>
          </div>
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

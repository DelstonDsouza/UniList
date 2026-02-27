import { useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../../utils/leafletIcons"
import { apiFetch } from "../../services/api"

// ─── MapClickLayer ─────────────────────────────────────────────────────────────
// Separate component so we can use useMapEvents inside MapContainer
function MapClickLayer({ onClick }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) })
  return null
}

// ─── Nominatim helpers — all via /nominatim proxy (no CORS issues) ─────────────
const nominatimReverse = async (lat, lng) => {
  try {
    const res  = await fetch(`/nominatim/reverse?format=json&lat=${lat}&lon=${lng}`)
    const data = await res.json()
    return data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

const nominatimSearch = async (q) => {
  try {
    const res  = await fetch(`/nominatim/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`)
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map((x) => ({
      display: x.display_name,
      lat:     parseFloat(x.lat),
      lng:     parseFloat(x.lon),
    }))
  } catch {
    return []
  }
}

// ─── OSRM route fetch — already direct, no CORS issue ─────────────────────────
const fetchRoute = async (origin, dest, signal) => {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
    `?overview=full&geometries=geojson`
  const res   = await fetch(url, { signal })
  const data  = await res.json()
  const route = data?.routes?.[0]
  if (!route) return null
  return {
    coords:  (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
    km:      (route.distance || 0) / 1000,
    etaMin:  Math.round(((route.distance || 0) / 1000 / 40) * 60),
  }
}

// ─── GiveRide ─────────────────────────────────────────────────────────────────
function GiveRide() {
  const navigate = useNavigate()

  const [offers,               setOffers]               = useState([])
  const [menuOpen,             setMenuOpen]             = useState(false)
  const [currentLoc,           setCurrentLoc]           = useState({ lat: 11.0168, lng: 76.9558 })
  const [pickupPoint,          setPickupPoint]          = useState(null)
  const [placeNames,           setPlaceNames]           = useState({})
  const [destination,          setDestination]          = useState("")
  const [departureTime,        setDepartureTime]        = useState("")
  const [saveForFuture,        setSaveForFuture]        = useState(false)
  const [pickupLater,          setPickupLater]          = useState(false)
  const [isPickupCurrent,      setIsPickupCurrent]      = useState(false)
  const [pickupQuery,          setPickupQuery]          = useState("")
  const [destinationQuery,     setDestinationQuery]     = useState("")
  const [pickupSuggestions,    setPickupSuggestions]    = useState([])
  const [destinationSuggestions, setDestinationSuggestions] = useState([])
  const [destinationLatLng,    setDestinationLatLng]    = useState(null)
  const [destinationSelected,  setDestinationSelected]  = useState(false)
  const [leafletMap,           setLeafletMap]           = useState(null)
  const [routeCoords,          setRouteCoords]          = useState([])
  const [routeKm,              setRouteKm]              = useState(null)
  const [routeEtaMin,          setRouteEtaMin]          = useState(null)
  const [showFareInfo,         setShowFareInfo]         = useState(false)

  // Abort controller ref — cancels in-flight OSRM requests on cleanup
  const routeAbortRef = useRef(null)

  const hasBlockingRide = useMemo(
    () => offers.some((o) => ["active", "ongoing"].includes(o.status)),
    [offers]
  )

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null")
    if (!u?.isRider) navigate("/become-rider")
  }, [navigate])

  // ── Get GPS on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    )
  }, [])

  // ── Reverse geocode a point (cached in placeNames) ─────────────────────────
  const fetchPlaceName = async (lat, lng) => {
    const key = `${lat},${lng}`
    if (placeNames[key]) return
    const name = await nominatimReverse(lat, lng)
    setPlaceNames((p) => ({ ...p, [key]: name }))
  }

  // ── Batch reverse geocode whenever markers change ──────────────────────────
  useEffect(() => {
    const coords = []
    if (pickupPoint) coords.push([pickupPoint.lat, pickupPoint.lng])
    if (currentLoc)  coords.push([currentLoc.lat,  currentLoc.lng])
    offers.forEach((o) => {
      if (o.pickupLat)    coords.push([o.pickupLat,    o.pickupLng])
      if (o.currentLat)   coords.push([o.currentLat,   o.currentLng])
      if (o.passengerLat) coords.push([o.passengerLat, o.passengerLng])
    })
    coords.forEach(([lat, lng]) => fetchPlaceName(lat, lng))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, pickupPoint, currentLoc])

  // ── Pickup autocomplete ────────────────────────────────────────────────────
  useEffect(() => {
    const h = setTimeout(async () => {
      if (pickupQuery.length > 2 && !pickupLater && !isPickupCurrent) {
        setPickupSuggestions(await nominatimSearch(pickupQuery))
      } else {
        setPickupSuggestions([])
      }
    }, 300)
    return () => clearTimeout(h)
  }, [pickupQuery, pickupLater, isPickupCurrent])

  // ── Destination autocomplete ───────────────────────────────────────────────
  useEffect(() => {
    const h = setTimeout(async () => {
      if (destinationQuery.length > 2 && !destinationSelected) {
        setDestinationSuggestions(await nominatimSearch(destinationQuery))
      } else {
        setDestinationSuggestions([])
      }
    }, 300)
    return () => clearTimeout(h)
  }, [destinationQuery, destinationSelected])

  // ── Route calculation (OSRM, safely aborted on cleanup) ───────────────────
  useEffect(() => {
    const origin = pickupPoint
      ? { lat: pickupPoint.lat, lng: pickupPoint.lng }
      : isPickupCurrent || pickupLater
        ? { lat: currentLoc.lat, lng: currentLoc.lng }
        : null
    const dest = destinationLatLng

    // Cancel any previous in-flight request
    if (routeAbortRef.current) routeAbortRef.current.abort()

    if (!origin || !dest) {
      setRouteCoords([])
      setRouteKm(null)
      setRouteEtaMin(null)
      return
    }

    const controller = new AbortController()
    routeAbortRef.current = controller

    fetchRoute(origin, dest, controller.signal)
      .then((result) => {
        if (!result) return
        setRouteCoords(result.coords)
        setRouteKm(result.km)
        setRouteEtaMin(result.etaMin)
      })
      .catch((err) => {
        // AbortError is expected when inputs change quickly — ignore silently
        if (err.name !== "AbortError") {
          console.warn("Route fetch failed:", err.message)
          setRouteCoords([])
          setRouteKm(null)
          setRouteEtaMin(null)
        }
      })

    // Cleanup: abort the fetch if the component unmounts or deps change
    return () => controller.abort()
  }, [
    pickupPoint?.lat, pickupPoint?.lng,
    currentLoc.lat,   currentLoc.lng,
    isPickupCurrent,  pickupLater,
    destinationLatLng?.lat, destinationLatLng?.lng,
  ])

  // ── Map click handler ──────────────────────────────────────────────────────
  const onMapClick = ([lat, lng]) => {
    setPickupPoint({ lat, lng })
    setIsPickupCurrent(false)
    setPickupLater(false)
    setPickupQuery(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    fetchPlaceName(lat, lng)
  }

  // ── Post offer ─────────────────────────────────────────────────────────────
  const postOffer = () => {
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

  const confirmPostOffer = async () => {
    const payload = {
      currentLat:    currentLoc.lat,
      currentLng:    currentLoc.lng,
      destination,
      departureTime,
      pickupLater,
      ...(pickupPoint ? { pickupLat: pickupPoint.lat, pickupLng: pickupPoint.lng } : {}),
    }

    const t = toast.loading("Posting ride...")
    try {
      const created  = await apiFetch("/ride-offers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      const offerId = created?.offer?.id || created?.offer?._id
      toast.success("Ride posted", { id: t })
      if (offerId) navigate(`/rider-wait/${offerId}`)
    } catch {
      toast.error("Failed to post ride", { id: t })
    }

    if (saveForFuture) {
      localStorage.setItem("savedRide", JSON.stringify({
        destination,
        departureTime,
        pickupLat: payload.pickupLat,
        pickupLng: payload.pickupLng,
      }))
    }

    // Reset form
    setPickupPoint(null)
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">

      {/* Menu trigger */}
      <button
        className="fixed left-4 top-4 z-50 p-3 rounded-xl bg-white dark:bg-slate-800 border shadow hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Open menu"
      >
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white mb-1" />
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white mb-1" />
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white" />
      </button>

      {/* Side menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 px-6 pt-16 pb-6">
            <h2 className="text-2xl font-extrabold mb-6 text-white">Menu</h2>
            <div className="space-y-0 divide-y divide-slate-700">
              {[
                { label: "PASSENGER", action: () => navigate("/dashboard") },
                {
                  label: "RIDER", action: () => {
                    const u = JSON.parse(localStorage.getItem("user") || "null")
                    navigate(u?.isRider ? "/giveride" : "/become-rider")
                  }
                },
                { label: "HISTORY", action: () => toast.success("History coming soon") },
                { label: "CONTACT", action: () => toast.success("Contact coming soon") },
                { label: "PROFILE", action: () => toast.success("Profile coming soon") },
                {
                  label: "LOGOUT", action: () => {
                    ["user", "isRider", "riderProfile", "token"].forEach((k) => localStorage.removeItem(k))
                    navigate("/login")
                  }
                },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={() => { setMenuOpen(false); action() }}
                  className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
                >
                  {label}
                </button>
              ))}
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

          {/* Map */}
          <div className="h-72 sm:h-96 border-t relative">
            <MapContainer
              center={[currentLoc.lat, currentLoc.lng]}
              zoom={14}
              style={{ height: "100%", width: "100%" }}
              // whenCreated is deprecated in newer react-leaflet — use ref pattern
              ref={(map) => { if (map && !leafletMap) setLeafletMap(map) }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* Map click handler as a proper child component */}
              <MapClickLayer onClick={onMapClick} />

              {/* Current location pin */}
              <Marker position={[currentLoc.lat, currentLoc.lng]}>
                <Popup>Current Location</Popup>
              </Marker>

              {/* Pickup pin */}
              {pickupPoint && (
                <Marker position={[pickupPoint.lat, pickupPoint.lng]}>
                  <Popup>Pickup Point</Popup>
                </Marker>
              )}

              {/* Route polyline */}
              {routeCoords.length > 0 && (
                <Polyline
                  positions={routeCoords}
                  pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9 }}
                />
              )}
            </MapContainer>

            {/* Route info badge */}
            {routeKm != null && routeEtaMin != null && (
              <div className="absolute top-4 right-4 z-400 bg-white dark:bg-slate-900 border rounded-full shadow px-3 py-2 text-sm font-semibold flex items-center gap-2">
                <span>{routeKm.toFixed(1)} km</span>
                <span className="text-slate-400">•</span>
                <span>{routeEtaMin} min</span>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="p-6 space-y-3">

            {/* Pickup */}
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
                      leafletMap?.setView([currentLoc.lat, currentLoc.lng], 15, { animate: true })
                    }}
                    disabled={hasBlockingRide}
                    title="Use current location"
                  >
                    ●
                  </button>
                  <button
                    className={`text-sm font-semibold ${pickupLater ? "text-blue-700" : "text-blue-600"} hover:text-blue-700`}
                    onClick={() => {
                      setPickupLater((v) => !v)
                      if (!pickupLater) { setIsPickupCurrent(false); setPickupPoint(null) }
                    }}
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

            {/* Destination */}
            <div className="flex items-center gap-3 rounded-xl border px-4 py-3 bg-white dark:bg-slate-950 relative">
              <span>🎓</span>
              <input
                className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white"
                placeholder="Enter destination"
                value={destinationQuery}
                onChange={(e) => {
                  setDestinationQuery(e.target.value)
                  setDestination(e.target.value)
                  setDestinationSelected(false)
                }}
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

            {/* Departure time */}
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

            {/* Save for future toggle */}
            <div className="rounded-xl border px-4 py-3 bg-white dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-blue-600">✔️</span>
                  <div className="text-slate-900 dark:text-white font-medium">Save this ride for future?</div>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={saveForFuture}
                    onChange={(e) => setSaveForFuture(e.target.checked)}
                    disabled={hasBlockingRide}
                  />
                  <span className="w-11 h-6 bg-slate-300 peer-checked:bg-blue-600 rounded-full relative transition">
                    <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:left-6" />
                  </span>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-2">Save your ride to use for next time.</p>
            </div>

            {/* Submit */}
            <button
              className={`w-full py-3 rounded-xl font-semibold text-white ${
                hasBlockingRide ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
              disabled={hasBlockingRide}
              onClick={postOffer}
            >
              {hasBlockingRide ? "Blocked by active ride" : "Find Passenger"}
            </button>
          </div>
        </section>
      </div>

      {/* Fare confirmation modal */}
      {showFareInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowFareInfo(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 z-10">
            <h3 className="text-lg font-bold mb-2">Fare Policy</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Minimum fare is ₹25. Additional ₹5 per km applies for distance traveled.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Final price is calculated after trip completion based on actual kilometers.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800"
                onClick={() => setShowFareInfo(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white"
                onClick={confirmPostOffer}
              >
                Confirm & Post
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default GiveRide
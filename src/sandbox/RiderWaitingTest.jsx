import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "../utils/leafletIconFix"
import toast from "react-hot-toast"
import { useRef } from "react"
import { apiFetch } from "../lib/api"

function RiderWait() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [offer, setOffer] = useState(null)
  const [routeCoords, setRouteCoords] = useState([])
  const [destLatLng, setDestLatLng] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ destination: "", departureTime: "" })
  const [errOnce, setErrOnce] = useState(false)
  const [failCount, setFailCount] = useState(0)
  const toastIdRef = useRef(`riderwait-load-${id}`)

  const hasPassenger = useMemo(() => !!offer && !!offer.passengerUid, [offer])

  useEffect(() => {
    if (!id) { navigate("/giveride"); return }
    let mounted = true
    const load = async () => {
      try {
        const data = await apiFetch(`/ride-offers/${id}`)
        if (!mounted) return
        setOffer(data.offer)
        setLoading(false)
        setErrOnce(false)
        setFailCount(0)
      } catch (err) {
        setLoading(false)
        if (!errOnce) {
          toast.error("Failed to load ride", { id: toastIdRef.current })
          setErrOnce(true)
        }
        try {
          const mine = await apiFetch(`/rider/ride-offers`)
          const latest = mine?.offers?.[0]
          if (latest) {
            setOffer(latest)
          }
        } catch {/* ignore */}
        setFailCount((c) => {
          const next = c + 1
          if (next >= 2) navigate("/giveride")
          return next
        })
      }
    }
    load()
    const t = setInterval(load, 3000)
    return () => { mounted = false; clearInterval(t) }
  }, [id])

  useEffect(() => {
    const geocodeDest = async () => {
      if (!offer?.destination) return
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(offer.destination)}&limit=1`
        const res = await fetch(url)
        const data = await res.json()
        const item = Array.isArray(data) && data[0]
        if (item) setDestLatLng({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) })
      } catch {/* ignore */}
    }
    geocodeDest()
  }, [offer?.destination])

  useEffect(() => {
    const buildRoute = async () => {
      const origin = offer?.pickupLat && offer?.pickupLng
        ? { lat: offer.pickupLat, lng: offer.pickupLng }
        : (offer?.currentLat && offer?.currentLng
            ? { lat: offer.currentLat, lng: offer.currentLng }
            : null)
      if (!origin || !destLatLng) return
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destLatLng.lng},${destLatLng.lat}?overview=full&geometries=geojson`
        const res = await fetch(url)
        const data = await res.json()
        if (data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
          setRouteCoords(coords)
        }
      } catch {/* ignore */}
    }
    buildRoute()
  }, [offer, destLatLng])

  const startRide = async () => {
    if (!offer) return
    const t = toast.loading("Starting ride…")
    try {
      const data = await apiFetch(`/ride-offers/${offer.id}/start`, { method: "POST" })
      toast.success("Ride started", { id: t })
      navigate(`/new-ride/${offer.id}`)
    } catch (err) {
      toast.error(err.message || "Cannot start yet", { id: t })
    }
  }
  const cancelRide = async () => {
    if (!offer) return
    const t = toast.loading("Cancelling…")
    try {
      await apiFetch(`/ride-offers/${offer.id}/cancel`, { method: "POST" })
      toast.success("Ride cancelled", { id: t })
      navigate("/giveride")
    } catch {
      toast.error("Failed to cancel", { id: t })
    }
  }
  const saveEdit = async () => {
    if (!offer) return
    const t = toast.loading("Saving…")
    try {
      const payload = {}
      if (editForm.destination) payload.destination = editForm.destination
      if (editForm.departureTime) payload.departureTime = editForm.departureTime
      const data = await apiFetch(`/ride-offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setOffer(data.offer)
      setEditing(false)
      toast.success("Updated", { id: t })
    } catch (err) {
      toast.error(err.message || "Failed to update", { id: t })
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
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
            <h2 className="text-2xl font-extrabold mb-6 text-white">Menu</h2>
            <div className="space-y-0 divide-y divide-slate-700">
              <button onClick={() => { setMenuOpen(false); navigate("/dashboard") }} className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800">PASSENGER</button>
              <button onClick={() => { setMenuOpen(false); navigate("/giveride") }} className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800">RIDER</button>
              <button onClick={() => { setMenuOpen(false); toast.success("Profile coming soon") }} className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800">PROFILE</button>
              <button onClick={() => { setMenuOpen(false); navigate("/login") }} className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800">LOGOUT</button>
            </div>
          </aside>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        <header className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Searching for passengers…
          </h1>
          <p className="text-sm text-slate-500">Your ride is visible to passengers.</p>
        </header>

        <section className="h-72 sm:h-96 border rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
          {!offer && loading && <div className="p-4 text-slate-500">Loading map…</div>}
          {offer && (
            <MapContainer
              center={[
                offer.pickupLat ?? offer.currentLat ?? 11.0168,
                offer.pickupLng ?? offer.currentLng ?? 76.9558
              ]}
              zoom={14}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {(offer.pickupLat && offer.pickupLng) && (
                <Marker position={[offer.pickupLat, offer.pickupLng]}>
                  <Popup>Start</Popup>
                </Marker>
              )}
              {(!offer.pickupLat || !offer.pickupLng) && (offer.currentLat && offer.currentLng) && (
                <Marker position={[offer.currentLat, offer.currentLng]}>
                  <Popup>Start (current)</Popup>
                </Marker>
              )}
              {destLatLng && (
                <Marker position={[destLatLng.lat, destLatLng.lng]}>
                  <Popup>Destination</Popup>
                </Marker>
              )}
              {routeCoords.length > 0 && (
                <Polyline positions={routeCoords} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9 }} />
              )}
            </MapContainer>
          )}
        </section>

        <section className="grid sm:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Ride details</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Your start:</span> {offer?.pickupLat && offer?.pickupLng ? `${offer.pickupLat.toFixed(5)}, ${offer.pickupLng.toFixed(5)}` : "Current location"}</div>
              <div><span className="font-medium">Destination:</span> {offer?.destination || "-"}</div>
              <div><span className="font-medium">Departure time:</span> {offer?.departureTime || "-"}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-red-600 text-white" onClick={cancelRide}>Cancel Ride</button>
              <button className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800" onClick={() => { setEditing(true); setEditForm({ destination: offer?.destination || "", departureTime: offer?.departureTime || "" }) }}>Edit Ride</button>
            </div>
            {editing && (
              <div className="mt-4 space-y-3">
                <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Destination" value={editForm.destination} onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })} />
                <input type="time" className="rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" value={editForm.departureTime} onChange={(e) => setEditForm({ ...editForm, departureTime: e.target.value })} />
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={saveEdit}>Save</button>
                  <button className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800" onClick={() => setEditing(false)}>Close</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Passenger status</h2>
            {!hasPassenger && (
              <div className="text-sm">
                <div className="font-medium mb-1">No passengers yet</div>
                <div className="text-slate-500 flex items-center gap-1">
                  Searching<span className="animate-pulse">…</span>
                </div>
              </div>
            )}
            {hasPassenger && (
              <div className="text-sm">
                <div className="font-medium mb-1">Passenger joined</div>
                <div className="text-slate-500">You can start the ride.</div>
                <button className="mt-3 px-4 py-2 rounded-lg bg-green-600 text-white" onClick={startRide}>Start Ride</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default RiderWait

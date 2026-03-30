// src/context/RideContext.jsx

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react"
import { apiFetch, getToken } from "../services/api"
import { socket, connectSocket, disconnectSocket } from "../services/socket"

const RideContext = createContext(null)

function mergeRiders(prev, next) {
  if (prev.length !== next.length) return next
  const sameContent = next.every((newRide, i) => {
    const old = prev[i]
    return (
      old &&
      old._id === newRide._id &&
      old.status === newRide.status &&
      old.distToRoute === newRide.distToRoute
    )
  })
  return sameContent ? prev : next
}

const ACTIVE_RIDE_STATUSES_RIDER = ["pending", "locked", "pickup_started", "ongoing"]

export function RideProvider({ children }) {
  // ── Passenger-side state ──────────────────────────────────────────────────
  const [viewState, setViewState] = useState("discovery")
  const [nearbyRiders, setNearbyRiders] = useState([])
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [activeRide, setActiveRide] = useState(null)
  const [fareInfo, setFareInfo] = useState(null)
  const [requestingRideId, setRequestingRideId] = useState(null)
  const [restoringRide, setRestoringRide] = useState(true)
  const [reachedData, setReachedData] = useState(null)
  const [completedData, setCompletedData] = useState(null)

  // ── Rider-side active ride (global) ──────────────────────────────────────
  const [riderActiveRide, setRiderActiveRide] = useState(null)

  const userLocationRef = useRef(null)
  const activeRideRef = useRef(null)
  const viewStateRef = useRef("discovery")
  const fetchingRef = useRef(false)

  useEffect(() => { activeRideRef.current = activeRide }, [activeRide])
  useEffect(() => { viewStateRef.current = viewState }, [viewState])

  // ── Computed global flags ─────────────────────────────────────────────────
  const hasActiveRide = !!(
    (activeRide && !["completed", "cancelled"].includes(activeRide.status)) ||
    (riderActiveRide && !["completed", "cancelled"].includes(riderActiveRide.status))
  )
  const activeRideRole = riderActiveRide ? "rider" : (activeRide ? "passenger" : null)

  // ── GPS ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError("Geolocation not supported"); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(loc)
        userLocationRef.current = loc
        setLocationError(null)
      },
      () => setLocationError("Location access denied — enable GPS to find nearby riders"),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // ── Map DB ride status → viewState ────────────────────────────────────────
  function statusToView(status) {
    if (status === "locked") return "confirmed"
    if (status === "pickup_started") return "waiting"
    if (status === "ongoing") return "ongoing"
    if (status === "completed") return "completed"
    return null
  }

  // ── Restore both passenger + rider active rides on page load ──────────────
  useEffect(() => {
    if (!getToken()) { setRestoringRide(false); return }

    const restoreAll = async () => {
      try {
        // Passenger active ride
        const passengerData = await apiFetch("/rides/active").catch(() => null)
        const pRide = passengerData?.ride || passengerData?.data?.ride
        if (pRide && ["locked", "pickup_started", "ongoing"].includes(pRide.status)) {
          setActiveRide(pRide)
          setFareInfo(pRide.fare || null)
          const vs = statusToView(pRide.status)
          if (vs) setViewState(vs)
        }

        // Rider active ride
        const riderData = await apiFetch("/rides/my").catch(() => null)
        const rRides = riderData?.data?.rides || []
        const rRide = rRides.find(r => ACTIVE_RIDE_STATUSES_RIDER.includes(r.status))
        if (rRide) setRiderActiveRide(rRide)

      } catch { /* ignore */ } finally {
        setRestoringRide(false)
      }
    }

    restoreAll()
  }, [])

  // ── Global back-button block when any ride is active ─────────────────────
  useEffect(() => {
    if (!hasActiveRide) return
    window.history.pushState(null, "", window.location.href)
    const block = () => window.history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", block)
    return () => window.removeEventListener("popstate", block)
  }, [hasActiveRide])

  // ── Fetch nearby riders ───────────────────────────────────────────────────
  const fetchRiders = useCallback(async (loc) => {
    if (!loc) return
    if (!getToken()) return
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoadingRiders(true)
    try {
      const [lat, lng] = loc
      const data = await apiFetch(`/rides/nearby?lat=${lat}&lng=${lng}`)
      const fresh = data?.rides || data?.data?.rides || []
      setNearbyRiders(prev => mergeRiders(prev, fresh))
    } catch {
      // Silently ignore
    } finally {
      fetchingRef.current = false
      setLoadingRiders(false)
    }
  }, [])

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    connectSocket()

    const joinRoom = () => socket.emit("join:riders-watch")
    socket.on("connect", joinRoom)
    if (socket.connected) joinRoom()
    const joinTimer = setTimeout(() => { if (socket.connected) joinRoom() }, 500)

    const handleNewRide = ({ ride }) => {
      if (!ride) return
      const loc = userLocationRef.current
      if (!loc) return
      const riderLat = ride.currentLocation?.coordinates?.[1]
      const riderLng = ride.currentLocation?.coordinates?.[0]
      if (!riderLat || !riderLng) return
      const R = 6371
      const dLat = ((riderLat - loc[0]) * Math.PI) / 180
      const dLng = ((riderLng - loc[1]) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((loc[0] * Math.PI) / 180) *
        Math.cos((riderLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
      const distKm = 2 * R * Math.asin(Math.sqrt(a))
      if (distKm <= 5) fetchRiders(loc)
    }

    const handleRideRemoved = ({ rideId }) =>
      setNearbyRiders(prev => prev.filter(r => r._id !== rideId))

    const handleRideCancelled = () => {
      setActiveRide(null); setFareInfo(null); setViewState("discovery")
      setRiderActiveRide(null)
    }
    const handlePickupStarted = () => setViewState("waiting")
    const handleRideStarted = () => setViewState("ongoing")
    const handleReachedDest = (data) => setReachedData(data)
    const handleRideCompleted = (data) => {
      setCompletedData(data);
      setReachedData(null);
      setViewState("completed");
      setActiveRide(null);
      setFareInfo(null);
      setRiderActiveRide(null);
    }

    socket.on("ride:new", handleNewRide)
    socket.on("ride:removed", handleRideRemoved)
    socket.on("ride:locked", handleRideRemoved)
    socket.on("ride:cancelled", handleRideCancelled)
    socket.on("ride:pickup_started", handlePickupStarted)
    socket.on("ride:started", handleRideStarted)
    socket.on("ride:reached_destination", handleReachedDest)
    socket.on("ride:completed", handleRideCompleted)

    return () => {
      clearTimeout(joinTimer)
      socket.off("connect", joinRoom)
      socket.off("ride:new", handleNewRide)
      socket.off("ride:removed", handleRideRemoved)
      socket.off("ride:locked", handleRideRemoved)
      socket.off("ride:cancelled", handleRideCancelled)
      socket.off("ride:pickup_started", handlePickupStarted)
      socket.off("ride:started", handleRideStarted)
      socket.off("ride:reached_destination", handleReachedDest)
      socket.off("ride:completed", handleRideCompleted)
      disconnectSocket(true)
    }
  }, [fetchRiders])

  // ── Join active ride socket room ──────────────────────────────────────────
  useEffect(() => {
    if (!activeRide?._id) return
    socket.emit("join:passenger", activeRide._id)
  }, [activeRide?._id])

  // ── Fallback poll for passenger ride status ───────────────────────────────
  useEffect(() => {
    if (viewState === "discovery" || viewState === "completed") return
    const poll = setInterval(async () => {
      try {
        const data = await apiFetch("/rides/active")
        const ride = data?.ride || data?.data?.ride
        const vs = viewStateRef.current
        if (!ride) {
          if (vs !== "discovery") { setViewState("discovery"); setActiveRide(null) }
          return
        }
        const prev = activeRideRef.current
        if (!prev || prev._id !== ride._id || prev.status !== ride.status || prev.otp !== ride.otp) {
          setActiveRide(ride)
          setFareInfo(ride.fare || null)
        }
        const newVs = statusToView(ride.status)
        if (newVs && newVs !== vs) setViewState(newVs)
      } catch { /* ignore */ }
    }, 8000)
    return () => clearInterval(poll)
  }, [viewState])

  // ── Request a ride (passenger) ────────────────────────────────────────────
  const requestRide = async (rideId, passengerName, passengerPhone, selectedLocation) => {
    if (hasActiveRide) throw new Error("Complete your current ride before joining a new one.")
    const location = selectedLocation || userLocation
    if (!location) throw new Error("Location required")
    setRequestingRideId(rideId)
    try {
      const [lat, lng] = location
      const data = await apiFetch(`/rides/${rideId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passengerLat: lat, passengerLng: lng, name: passengerName, phone: passengerPhone }),
      })
      const ride = data?.ride || data?.data?.ride
      if (!ride) throw new Error("Unexpected server response")
      setActiveRide(ride)
      setFareInfo(ride.fare)
      setViewState("confirmed")
      setNearbyRiders(prev => prev.filter(r => r._id !== rideId))
      return ride
    } finally {
      setRequestingRideId(null)
    }
  }

  const acknowledgeFare = () => setViewState("confirmed")
  const resetToDiscovery = () => {
    setActiveRide(null); setFareInfo(null)
    setViewState("discovery")
  }

  const setRiderRideActive = useCallback((ride) => {
    setRiderActiveRide(ride || null)
  }, [])

  if (restoringRide) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading your ride…</p>
      </div>
    </div>
  )

  return (
    <RideContext.Provider value={{
      viewState, nearbyRiders, loadingRiders,
      userLocation, locationError,
      activeRide, fareInfo, requestingRideId,
      reachedData, completedData,
      setReachedData, setCompletedData,
      setViewState,
      requestRide, acknowledgeFare, resetToDiscovery,
      fetchRiders,
      riderActiveRide, setRiderRideActive,
      hasActiveRide, activeRideRole,
    }}>
      {children}
    </RideContext.Provider>
  )
}

export function useRide() {
  const ctx = useContext(RideContext)
  if (!ctx) throw new Error("useRide must be used inside <RideProvider>")
  return ctx
}
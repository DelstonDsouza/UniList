// src/context/RideContext.jsx

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react"
import { apiFetch, getToken } from "../services/api"
import { socket, connectSocket, disconnectSocket } from "../services/socket"

const RideContext = createContext(null)

export function RideProvider({ children }) {
  const [viewState,        setViewState]        = useState("discovery")
  const [nearbyRiders,     setNearbyRiders]     = useState([])
  const [loadingRiders,    setLoadingRiders]    = useState(false)
  const [userLocation,     setUserLocation]     = useState(null)
  const [locationError,    setLocationError]    = useState(null)
  const [activeRide,       setActiveRide]       = useState(null)
  const [fareInfo,         setFareInfo]         = useState(null)
  const [requestingRideId, setRequestingRideId] = useState(null)
  const [restoringRide,    setRestoringRide]    = useState(true)  // ✅ blocks render until check done

  const userLocationRef = useRef(null)
  const activeRideRef   = useRef(null)
  const viewStateRef    = useRef("discovery")

  useEffect(() => { activeRideRef.current = activeRide }, [activeRide])
  useEffect(() => { viewStateRef.current  = viewState  }, [viewState])

  // ── GPS ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported")
      return
    }
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

  // ── ✅ Restore active ride on page refresh / mount ────────────────────────
  // Runs once. If the passenger has an active ride in DB, restore correct view.
  useEffect(() => {
    if (!getToken()) { setRestoringRide(false); return }

    apiFetch("/rides/active")
      .then(data => {
        const ride = data?.ride || data?.data?.ride
        if (!ride) return

        setActiveRide(ride)
        setFareInfo(ride.fare || null)

        if (ride.status === "locked")    setViewState("waiting")
        if (ride.status === "ongoing")   setViewState("ongoing")
        if (ride.status === "completed") setViewState("completed")
      })
      .catch(() => {})
      .finally(() => setRestoringRide(false))
  }, [])

  // ── Fetch nearby riders ───────────────────────────────────────────────────────
  const fetchRiders = useCallback(async (loc) => {
    const coords = loc || userLocationRef.current
    if (!coords || !getToken()) return
    setLoadingRiders(true)
    try {
      const [lat, lng] = coords
      const data = await apiFetch(`/rides/nearby?lat=${lat}&lng=${lng}`)
      setNearbyRiders(data?.rides || data?.data?.rides || [])
    } catch {
      // silently ignore
    } finally {
      setLoadingRiders(false)
    }
  }, [])

  // ── Socket setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    connectSocket()

    const joinRoom = () => {
      socket.emit("join:riders-watch")
      console.log("Joined riders-watch room")
    }
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
      const R    = 6371
      const dLat = ((riderLat - loc[0]) * Math.PI) / 180
      const dLng = ((riderLng - loc[1]) * Math.PI) / 180
      const a    =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((loc[0] * Math.PI) / 180) *
        Math.cos((riderLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
      const dist = 2 * R * Math.asin(Math.sqrt(a))
      if (dist <= 5) {
        setNearbyRiders(prev => {
          if (prev.find(r => r._id === ride._id)) return prev
          return [ride, ...prev]
        })
      }
    }

    const handleRideRemoved   = ({ rideId }) => setNearbyRiders(prev => prev.filter(r => r._id !== rideId))
    const handleRideCancelled = () => { setActiveRide(null); setFareInfo(null); setViewState("discovery") }
    const handleRideStarted   = () => setViewState("ongoing")
    const handleRideCompleted = () => setViewState("completed")

    socket.on("ride:new",       handleNewRide)
    socket.on("ride:removed",   handleRideRemoved)
    socket.on("ride:locked",    handleRideRemoved)
    socket.on("ride:cancelled", handleRideCancelled)
    socket.on("ride:started",   handleRideStarted)
    socket.on("ride:completed", handleRideCompleted)

    return () => {
      clearTimeout(joinTimer)
      socket.off("connect",        joinRoom)
      socket.off("ride:new",       handleNewRide)
      socket.off("ride:removed",   handleRideRemoved)
      socket.off("ride:locked",    handleRideRemoved)
      socket.off("ride:cancelled", handleRideCancelled)
      socket.off("ride:started",   handleRideStarted)
      socket.off("ride:completed", handleRideCompleted)
      disconnectSocket(true)
    }
  }, [])

  // ── Fetch riders when GPS ready + 30s refresh ────────────────────────────────
  useEffect(() => {
    if (!userLocation) return
    fetchRiders(userLocation)
    const t = setInterval(() => fetchRiders(userLocation), 30000)
    return () => clearInterval(t)
  }, [userLocation, fetchRiders])

  // ── Join active ride room ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRide?._id) return
    socket.emit("join:passenger", activeRide._id)
  }, [activeRide?._id])

  // ── Fallback poll — only when ride is active ──────────────────────────────────
  useEffect(() => {
    if (viewState === "discovery" || viewState === "completed") return

    const poll = setInterval(async () => {
      try {
        const data = await apiFetch("/rides/active")
        const ride = data?.ride || data?.data?.ride
        const vs   = viewStateRef.current

        if (!ride) {
          if (vs !== "discovery") { setViewState("discovery"); setActiveRide(null) }
          return
        }

        const prev = activeRideRef.current
        if (!prev || prev._id !== ride._id || prev.status !== ride.status) {
          setActiveRide(ride)
        }

        if (ride.status === "locked"    && vs !== "waiting")   setViewState("waiting")
        if (ride.status === "ongoing"   && vs !== "ongoing")   setViewState("ongoing")
        if (ride.status === "completed" && vs !== "completed") setViewState("completed")
      } catch { /* ignore */ }
    }, 10000)

    return () => clearInterval(poll)
  }, [viewState])

  // ── Request a ride ────────────────────────────────────────────────────────────
  const requestRide = async (rideId, passengerName, passengerPhone, selectedLocation) => {
    const location = selectedLocation || userLocation
    if (!location) throw new Error("Location required")
    setRequestingRideId(rideId)
    try {
      const [lat, lng] = location
      const data = await apiFetch(`/rides/${rideId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengerLat: lat,
          passengerLng: lng,
          name:         passengerName,
          phone:        passengerPhone,
        }),
      })
      const ride = data?.ride || data?.data?.ride
      if (!ride) throw new Error("Unexpected server response")
      setActiveRide(ride)
      setFareInfo(ride.fare)
      setViewState("fare_reveal")
      setNearbyRiders(prev => prev.filter(r => r._id !== rideId))
      return ride
    } finally {
      setRequestingRideId(null)
    }
  }

  const acknowledgeFare  = () => setViewState("waiting")
  const resetToDiscovery = () => {
    setActiveRide(null)
    setFareInfo(null)
    setViewState("discovery")
    fetchRiders()
  }

  // ✅ Brief loading screen while checking for active ride on refresh
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
      viewState,
      nearbyRiders,
      loadingRiders,
      userLocation,
      locationError,
      activeRide,
      fareInfo,
      requestingRideId,
      requestRide,
      acknowledgeFare,
      resetToDiscovery,
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
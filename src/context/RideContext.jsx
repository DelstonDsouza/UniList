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

  const userLocationRef = useRef(null)

  // ── GPS ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported by your browser")
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

  // ── Socket setup — runs ONCE on mount, stays alive forever ──────────────────
  // This is intentionally NOT dependent on viewState so it never tears down
  useEffect(() => {
    connectSocket()

    // Join riders-watch immediately and on every reconnect
    const joinRoom = () => {
      socket.emit("join:riders-watch")
      console.log("Joined riders-watch room")
    }

    socket.on("connect", joinRoom)
    // Always join immediately regardless of connection state
    // If not connected yet, connectSocket() above will trigger the connect event
    if (socket.connected) {
      joinRoom()
    }
    // Also re-join after a short delay as safety net
    const joinTimer = setTimeout(() => {
      if (socket.connected) joinRoom()
    }, 500)

    // New ride posted by a rider → add to list if within 3km
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

      if (dist <= 3) {
        setNearbyRiders(prev => {
          if (prev.find(r => r._id === ride._id)) return prev
          return [ride, ...prev]
        })
        console.log("ride:new added to list:", ride._id)
      }
    }

    // Ride cancelled or taken → remove from list immediately
    const handleRideRemoved = ({ rideId }) => {
      console.log("ride:removed received — removing:", rideId)
      setNearbyRiders(prev => prev.filter(r => r._id !== rideId))
    }

    // Rider cancelled after passenger locked — send passenger back to discovery
    const handleRideCancelled = ({ rideId }) => {
      console.log("ride:cancelled received:", rideId)
      setActiveRide(null)
      setFareInfo(null)
      setViewState("discovery")
    }

    // Rider started ride → passenger moves to ongoing
    const handleRideStarted = () => {
      setViewState("ongoing")
    }

    // Ride completed
    const handleRideCompleted = () => {
      setViewState("completed")
    }

    socket.on("ride:new",       handleNewRide)
    socket.on("ride:removed",   handleRideRemoved)
    socket.on("ride:locked",    handleRideRemoved)   // taken by someone else
    socket.on("ride:cancelled", handleRideCancelled)
    socket.on("ride:started",   handleRideStarted)
    socket.on("ride:completed", handleRideCompleted)

    return () => {
      clearTimeout(joinTimer)
      socket.off("connect",       joinRoom)
      socket.off("ride:new",       handleNewRide)
      socket.off("ride:removed",   handleRideRemoved)
      socket.off("ride:locked",    handleRideRemoved)
      socket.off("ride:cancelled", handleRideCancelled)
      socket.off("ride:started",   handleRideStarted)
      socket.off("ride:completed", handleRideCompleted)
      disconnectSocket(true)
    }
  }, []) // ← empty deps — runs once, never tears down mid-session

  // ── Fetch riders when GPS is ready ───────────────────────────────────────────
  useEffect(() => {
    if (!userLocation) return
    fetchRiders(userLocation)

    // Safety net refresh every 30s
    const t = setInterval(() => fetchRiders(userLocation), 5000)  
    return () => clearInterval(t)
  }, [userLocation, fetchRiders])

  // ── Join active ride room when passenger has a ride ───────────────────────────
  useEffect(() => {
    if (!activeRide?._id) return
    socket.emit("join:passenger", activeRide._id)
    console.log("Joined ride room:", activeRide._id)
  }, [activeRide?._id])

  // ── Fallback poll for active ride status ──────────────────────────────────────
  useEffect(() => {
    if (viewState === "discovery" || viewState === "completed") return

    const poll = setInterval(async () => {
      try {
        const data = await apiFetch("/rides/active")
        const ride = data?.ride || data?.data?.ride
        if (!ride) {
          setViewState("discovery")
          setActiveRide(null)
          return
        }
        setActiveRide(ride)
        if (ride.status === "locked"    && viewState !== "waiting")   setViewState("waiting")
        if (ride.status === "ongoing"   && viewState !== "ongoing")   setViewState("ongoing")
        if (ride.status === "completed" && viewState !== "completed") setViewState("completed")
      } catch { /* ignore */ }
    }, 10000)

    return () => clearInterval(poll)
  }, [viewState])

  // ── Request a ride ────────────────────────────────────────────────────────────
  const requestRide = async (rideId, passengerName, passengerPhone) => {
    if (!userLocation) throw new Error("GPS location required. Enable location and try again.")
    setRequestingRideId(rideId)
    try {
      const [lat, lng] = userLocation
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
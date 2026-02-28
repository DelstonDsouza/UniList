// src/context/RideContext.jsx

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { apiFetch, getToken } from "../services/api"

const RideContext = createContext(null)

export function RideProvider({ children }) {
  const [viewState, setViewState] = useState("discovery")

  const [nearbyRiders, setNearbyRiders]   = useState([])
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [userLocation, setUserLocation]   = useState(null)
  const [locationError, setLocationError] = useState(null)

  const [activeRide, setActiveRide]               = useState(null)
  const [fareInfo, setFareInfo]                   = useState(null)
  const [requestingRideId, setRequestingRideId]   = useState(null)

  const pollRef = useRef(null)

  // ── Get GPS on mount ──────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported by your browser")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
        setLocationError(null)
      },
      () => setLocationError("Location access denied — enable GPS to find nearby riders"),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // ── Fetch nearby riders when GPS is ready ─────────────────
  useEffect(() => {
    if (!userLocation || viewState !== "discovery") return
    if (!getToken()) return  // ← don't fetch if not logged in

    const fetchRiders = async () => {
      setLoadingRiders(true)
      try {
        const [lat, lng] = userLocation
        const data = await apiFetch(`/rides/nearby?lat=${lat}&lng=${lng}`)
        setNearbyRiders(data?.rides || data?.data?.rides || [])
      } catch {
        // silently ignore — user just sees empty list
      } finally {
        setLoadingRiders(false)
      }
    }

    fetchRiders()
    const t = setInterval(fetchRiders, 15000)
    return () => clearInterval(t)
  }, [userLocation, viewState])

  // ── Poll active ride every 5s when not in discovery ───────
  useEffect(() => {
    if (viewState === "discovery") {
      clearInterval(pollRef.current)
      return
    }

    const poll = async () => {
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
        if (ride.status === "completed" && viewState !== "completed") {
          setViewState("completed")
          clearInterval(pollRef.current)
        }
      } catch {
        /* ignore network errors */
      }
    }

    poll()
    pollRef.current = setInterval(poll, 5000)
    return () => clearInterval(pollRef.current)
  }, [viewState])

  // ── Lock a ride (passenger requests) ──────────────────────
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
          name: passengerName,
          phone: passengerPhone,
        }),
      })

      const ride = data?.ride || data?.data?.ride
      if (!ride) throw new Error("Unexpected server response")

      setActiveRide(ride)
      setFareInfo(ride.fare)
      setViewState("fare_reveal")
      return ride
    } finally {
      setRequestingRideId(null)
    }
  }

  const acknowledgeFare = () => setViewState("waiting")

  const resetToDiscovery = () => {
    setActiveRide(null)
    setFareInfo(null)
    setViewState("discovery")
  }

  return (
    <RideContext.Provider
      value={{
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
      }}
    >
      {children}
    </RideContext.Provider>
  )
}

export function useRide() {
  const ctx = useContext(RideContext)
  if (!ctx) throw new Error("useRide must be used inside <RideProvider>")
  return ctx
}
// src/hooks/useRideListener.js
import { useEffect, useRef } from "react"
import { listenToRide } from "../services/rideService"

export const useRideListener = (rideId, onUpdate) => {
  const cbRef = useRef(onUpdate)
  cbRef.current = onUpdate

  useEffect(() => {
    if (!rideId) return
    const unsub = listenToRide(rideId, (data) => cbRef.current(data))
    return unsub
  }, [rideId])
}
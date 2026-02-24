// src/context/RideContext.jsx
import { createContext, useContext, useReducer, useCallback } from "react"

const RideContext = createContext(null)

const initialState = {
  rideId:          null,
  status:          null,
  otp:             null,
  origin:          null,
  destination:     null,
  passengerPickup: null,
  passengerName:   null,
  passengerRating: null,
  riderName:       null,
  distance:        null,
  fare:            null,
  departureTime:   null,
}

const rideReducer = (state, action) => {
  switch (action.type) {
    case "SET_RIDE":   return { ...state, ...action.payload }
    case "SET_STATUS": return { ...state, status: action.payload }
    case "CLEAR_RIDE": return initialState
    default:           return state
  }
}

export const RideProvider = ({ children }) => {
  const [ride, dispatch] = useReducer(rideReducer, initialState)

  const setRide   = useCallback((payload) => dispatch({ type: "SET_RIDE",   payload }), [])
  const setStatus = useCallback((status)  => dispatch({ type: "SET_STATUS", payload: status }), [])
  const clearRide = useCallback(()        => dispatch({ type: "CLEAR_RIDE" }), [])

  return (
    <RideContext.Provider value={{ ride, setRide, setStatus, clearRide }}>
      {children}
    </RideContext.Provider>
  )
}

export const useRide = () => {
  const ctx = useContext(RideContext)
  if (!ctx) throw new Error("useRide must be used inside RideProvider")
  return ctx
}
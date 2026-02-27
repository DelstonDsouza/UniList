// src/services/rideService.js
import { db } from "../config/firebase"
import {
  ref, set, get, update, push, onValue, off, serverTimestamp,
} from "firebase/database"

export const generateOTP = () =>
  Math.floor(1000 + Math.random() * 9000).toString()

export const createRide = async ({ riderId, riderName, origin, destination, departureTime }) => {
  const ridesRef = ref(db, "rides")
  const newRef = push(ridesRef)
  const otp = generateOTP()

  await set(newRef, {
    id: newRef.key,
    riderId,
    riderName,
    origin,
    destination,
    departureTime,
    otp,
    otpVerified: false,
    otpAttempts: 0,
    status: "searching",
    passengerId: null,
    passengerName: null,
    passengerPickup: null,
    passengerRating: null,
    distance: null,
    fare: null,
    createdAt: serverTimestamp(),
  })

  return { rideId: newRef.key, otp }
}

export const verifyRideOTP = async (rideId, enteredOTP) => {
  const rideRef = ref(db, `rides/${rideId}`)
  const snapshot = await get(rideRef)

  if (!snapshot.exists()) throw new Error("Ride not found")

  const ride = snapshot.val()
  const attempts = (ride.otpAttempts || 0) + 1

  if (ride.otp === enteredOTP) {
    await update(rideRef, { otpVerified: true, otpAttempts: attempts, status: "active" })
    return { success: true }
  }

  await update(rideRef, { otpAttempts: attempts })
  return { success: false, attempts }
}

export const completeRide = async (rideId) => {
  await update(ref(db, `rides/${rideId}`), {
    status: "completed",
    completedAt: serverTimestamp(),
  })
}

export const listenToRide = (rideId, callback) => {
  const rideRef = ref(db, `rides/${rideId}`)
  onValue(rideRef, (snap) => { if (snap.exists()) callback(snap.val()) })
  return () => off(rideRef)
}
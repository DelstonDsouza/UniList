// src/utils/geo.js
// Centralised geo + pricing utilities for RideMate backend logic.

// Fixed college destination (St Aloysius College, Mangalore)
export const COLLEGE = {
  lat: 12.872109642876621,
  lng: 74.84534749009204,
  label: "St Aloysius College, Mangalore",
}

// Basic sanity check for coordinates
export function isValidCoord(lat, lng) {
  const nLat = Number(lat)
  const nLng = Number(lng)
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false
  if (nLat < -90 || nLat > 90) return false
  if (nLng < -180 || nLng > 180) return false
  return true
}

// Haversine great‑circle distance between two coordinates, in kilometres
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180

  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lng2 - lng1)

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const R = 6371 // Earth radius in km

  return R * c
}

// Fare calculation based ONLY on passenger → college distance.
// Rules:
//   - ₹5 per km
//   - Minimum fare = ₹20
//   - If (distance * 5 < 20) then fare = 20
//   - Otherwise fare = distance * 5 (rounded to nearest rupee)
export function calculateFare(passengerLat, passengerLng) {
  if (!isValidCoord(passengerLat, passengerLng)) {
    throw new Error("Invalid passenger coordinates for fare calculation")
  }

  const kmRaw = haversineKm(passengerLat, passengerLng, COLLEGE.lat, COLLEGE.lng)
  const km = Number(kmRaw.toFixed(1))

  const rawFare = km * 5
  const fare = rawFare < 20 ? 20 : Math.round(rawFare)

  return { km, fare }
}

// Check whether a passenger is within the 3 km pickup radius of the rider.
export function isWithinPickupRadius(riderLat, riderLng, passengerLat, passengerLng) {
  if (!isValidCoord(riderLat, riderLng) || !isValidCoord(passengerLat, passengerLng)) {
    return { valid: false, distanceKm: NaN }
  }

  const distance = haversineKm(riderLat, riderLng, passengerLat, passengerLng)
  const distanceKm = Number(distance.toFixed(2))

  return {
    valid: distanceKm <= 3,
    distanceKm,
  }
}

// Simple 4‑digit OTP generator for rides.
export function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}


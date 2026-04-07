// server/services/fare.service.js
// Fare = max(₹20, ceil(distanceKm) * ₹5)
// Distance = passenger GPS → college GPS (Haversine)

import { haversineKm } from "../utils/geo.js"

/**
 * @param {number} passengerLat
 * @param {number} passengerLng
 * @param {number} collegeLat   - from College document (coordinates[1])
 * @param {number} collegeLng   - from College document (coordinates[0])
 * @returns {{ distanceKm: number, amount: number }}
 */
export function calculateFare(passengerLat, passengerLng, collegeLat, collegeLng) {
  const distanceKm = haversineKm(passengerLat, passengerLng, collegeLat, collegeLng)
  const rounded = Math.max(0, parseFloat(distanceKm.toFixed(1)))
  const rawFare = rounded * 5
  const amount = rawFare < 20 ? 20 : Math.round(rawFare)
  return { distanceKm: rounded, amount }
}
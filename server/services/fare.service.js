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
  const rounded = Math.max(0, parseFloat(distanceKm.toFixed(2)))
  const amount = Math.max(20, Math.ceil(rounded) * 5)
  return { distanceKm: rounded, amount }
}
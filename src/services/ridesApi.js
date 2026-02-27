// src/services/ridesApi.js
// Thin client for the new /api/rides endpoints backed by src/services/ride.service.js logic.
// Passenger UI can import these helpers to respect the 3 km radius and petrol rules.

import { apiFetch } from "./api"

// GET /api/rides/nearby?lat=&lng=
// Returns only rides whose riders are within 3 km of the passenger,
// including fare previews based on passenger → college distance.
export async function getNearbyRides(passengerLat, passengerLng) {
  const params = new URLSearchParams({
    lat: String(passengerLat),
    lng: String(passengerLng),
  })
  const res = await apiFetch(`/rides/nearby?${params.toString()}`)
  return res?.rides || res || []
}


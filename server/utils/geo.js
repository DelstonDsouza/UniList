// server/utils/geo.js

export const COLLEGE = {
  lat: 12.872109642876621,
  lng: 74.84534749009204,
  label: "St Aloysius College, Mangalore",
}

export function isValidCoord(lat, lng) {
  const nLat = Number(lat)
  const nLng = Number(lng)
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false
  if (nLat < -90  || nLat > 90)  return false
  if (nLng < -180 || nLng > 180) return false
  return true
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const φ1 = toRad(lat1), φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lng2 - lng1)
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function calculateFare(passengerLat, passengerLng) {
  if (!isValidCoord(passengerLat, passengerLng))
    throw new Error("Invalid passenger coordinates for fare calculation")
  const kmRaw = haversineKm(passengerLat, passengerLng, COLLEGE.lat, COLLEGE.lng)
  const km    = Number(kmRaw.toFixed(1))
  const fare  = Math.max(20, Math.round(km * 5))
  return { km, fare }
}

export function isWithinPickupRadius(riderLat, riderLng, passengerLat, passengerLng) {
  if (!isValidCoord(riderLat, riderLng) || !isValidCoord(passengerLat, passengerLng))
    return { valid: false, distanceKm: NaN }
  const distanceKm = Number(haversineKm(riderLat, riderLng, passengerLat, passengerLng).toFixed(2))
  return { valid: distanceKm <= 3, distanceKm }
}

export function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// ── Route-based matching helpers ─────────────────────────────────────────────

/**
 * Fetch OSRM route between two points.
 * Returns array of [lat, lng] waypoints or null on failure.
 */
export async function fetchOSRMRoute(fromLat, fromLng, toLat, toLng) {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?overview=full&geometries=geojson`
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    if (!coords?.length) return null
    // OSRM returns [lng, lat] — convert to [lat, lng]
    return coords.map(([lng, lat]) => [lat, lng])
  } catch {
    return null
  }
}

/**
 * Find the closest point on a polyline to a given location.
 *
 * Returns:
 *   nearestLat   – lat of the closest projected point on the route
 *   nearestLng   – lng of the closest projected point on the route
 *   distanceKm   – straight-line distance from passenger to nearest route point
 *   routeIndex   – index of the segment start where the nearest point was found
 *                  (used by ride.service.js to check passenger is ahead of rider)
 */
export function nearestPointOnRoute(routePoints, passengerLat, passengerLng) {
  let bestDist  = Infinity
  let bestLat   = routePoints[0][0]
  let bestLng   = routePoints[0][1]
  let bestIndex = 0

  for (let i = 0; i < routePoints.length - 1; i++) {
    const [lat1, lng1] = routePoints[i]
    const [lat2, lng2] = routePoints[i + 1]

    const dx   = lat2 - lat1
    const dy   = lng2 - lng1
    const len2 = dx * dx + dy * dy
    let   t    = 0

    if (len2 > 0) {
      t = ((passengerLat - lat1) * dx + (passengerLng - lng1) * dy) / len2
      t = Math.max(0, Math.min(1, t))
    }

    const projLat = lat1 + t * dx
    const projLng = lng1 + t * dy
    const dist    = haversineKm(passengerLat, passengerLng, projLat, projLng)

    if (dist < bestDist) {
      bestDist  = dist
      bestLat   = projLat
      bestLng   = projLng
      bestIndex = i   // ✅ track which segment the nearest point belongs to
    }
  }

  return {
    nearestLat:  bestLat,
    nearestLng:  bestLng,
    distanceKm:  Number(bestDist.toFixed(3)),
    routeIndex:  bestIndex,   // ✅ returned for ahead-of-rider check
  }
}

/**
 * Reverse geocode a coordinate to a short area name.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "RideMateApp/1.0" }, signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()
    const a    = data?.address || {}
    return (
      a.neighbourhood || a.suburb || a.village ||
      a.town || a.city_district || a.county ||
      data?.display_name?.split(",")[0] ||
      `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    )
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}
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
  if (nLat < -90 || nLat > 90) return false
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
  const km = Number(kmRaw.toFixed(1))
  const fare = Math.round(25 + (km * 5))
  return { km, fare }
}

export function calculateETA(distanceKm) {
  return Math.round((distanceKm / 32) * 60)
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

// ── In-memory route cache ─────────────────────────────────────────────────────
// Key: "lat,lng→lat,lng" (rounded to 4dp to reuse nearby coords)
// TTL: 10 minutes — routes don't change, this prevents hammering OSRM
const routeCache = new Map()
const CACHE_TTL_MS = 10 * 60 * 1000   // 10 minutes

function cacheKey(fromLat, fromLng, toLat, toLng) {
  const r = (n) => Number(n).toFixed(4)
  return `${r(fromLat)},${r(fromLng)}->${r(toLat)},${r(toLng)}`
}

/**
 * Fetch OSRM route between two points, with in-memory cache + one retry.
 * Returns array of [lat, lng] waypoints, or null on failure.
 */
export async function fetchOSRMRoute(fromLat, fromLng, toLat, toLng) {
  const key = cacheKey(fromLat, fromLng, toLat, toLng)
  const cached = routeCache.get(key)

  // Return cached result if still fresh
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.points
  }

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson`

  const attemptFetch = async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    if (!coords?.length) return null
    // OSRM returns [lng, lat] — convert to [lat, lng]
    return coords.map(([lng, lat]) => [lat, lng])
  }

  try {
    let points = await attemptFetch()

    // One retry after 1s if first attempt fails
    if (!points) {
      await new Promise(r => setTimeout(r, 1000))
      points = await attemptFetch()
    }

    // Cache result (even null, to avoid hammering on bad coords)
    routeCache.set(key, { points, ts: Date.now() })
    return points
  } catch {
    // Cache null briefly to avoid retry storm
    routeCache.set(key, { points: null, ts: Date.now() })
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
 */
export function nearestPointOnRoute(routePoints, passengerLat, passengerLng) {
  let bestDist = Infinity
  let bestLat = routePoints[0][0]
  let bestLng = routePoints[0][1]
  let bestIndex = 0

  for (let i = 0; i < routePoints.length - 1; i++) {
    const [lat1, lng1] = routePoints[i]
    const [lat2, lng2] = routePoints[i + 1]

    const dx = lat2 - lat1
    const dy = lng2 - lng1
    const len2 = dx * dx + dy * dy
    let t = 0

    if (len2 > 0) {
      t = ((passengerLat - lat1) * dx + (passengerLng - lng1) * dy) / len2
      t = Math.max(0, Math.min(1, t))
    }

    const projLat = lat1 + t * dx
    const projLng = lng1 + t * dy
    const dist = haversineKm(passengerLat, passengerLng, projLat, projLng)

    if (dist < bestDist) {
      bestDist = dist
      bestLat = projLat
      bestLng = projLng
      bestIndex = i
    }
  }

  return {
    nearestLat: bestLat,
    nearestLng: bestLng,
    distanceKm: Number(bestDist.toFixed(3)),
    routeIndex: bestIndex,
  }
}

/**
 * Reverse geocode a coordinate to a human-readable address string.
 * Produces: "Road, Suburb, City" like "Devarapadau Cross Rd, Vamanjoor, Mangalore"
 */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { "User-Agent": "RideMateApp/1.0", "Accept-Language": "en" }, signal: AbortSignal.timeout(6000) }
    )
    const data = await res.json()
    const a = data?.address || {}

    const road = a.road || a.pedestrian || a.footway || a.path || a.cycleway || ""
    const area = a.neighbourhood || a.suburb || a.village || a.hamlet || ""
    const city = a.city || a.town || a.city_district || a.county || ""

    const parts = [road, area, city].filter(Boolean)
    if (parts.length >= 2) return parts.join(", ")
    if (parts.length === 1) return parts[0]

    // Fallback: first 3 segments of display_name
    const fallback = data?.display_name?.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3).join(", ")
    return fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}
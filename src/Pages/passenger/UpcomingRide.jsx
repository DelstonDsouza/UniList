// src/pages/passenger/UpcomingRide.jsx

import { useEffect, useState } from "react"
import { useRide } from "../../context/RideContext"

const NOMINATIM = "/nominatim"
const NOM_HEADERS = { "Accept-Language": "en", "User-Agent": "RideMateApp/1.0" }

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: NOM_HEADERS })
    const data = await res.json()
    const a = data.address || {}
    const road = a.road || ""
    const area = a.neighbourhood || a.suburb || ""
    const city = a.city || a.town || a.village || a.county || ""
    if (road && area && city) return `${road}, ${area}, ${city}`
    if (road && city) return `${road}, ${city}`
    if (area && city) return `${area}, ${city}`
    if (city) return city
    return data.display_name?.split(",").slice(0, 3).join(",").trim() ?? "Your location"
  } catch {
    return "Your location"
  }
}

// Haversine distance in km
function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// arrivalTime = departureTime + etaMinutes
function calcArrivalTime(departureTimeStr, etaMinutes) {
  if (!departureTimeStr || etaMinutes == null) return null
  const str = departureTimeStr.trim()
  const ampm = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  const h24 = str.match(/^(\d{1,2}):(\d{2})$/)
  let hours, minutes
  if (ampm) {
    hours = parseInt(ampm[1]); minutes = parseInt(ampm[2])
    const p = ampm[3].toUpperCase()
    if (p === "PM" && hours !== 12) hours += 12
    if (p === "AM" && hours === 12) hours = 0
  } else if (h24) {
    hours = parseInt(h24[1]); minutes = parseInt(h24[2])
  } else return null
  const total = hours * 60 + minutes + etaMinutes
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  const period = h >= 12 ? "PM" : "AM"
  const dh = h % 12 === 0 ? 12 : h % 12
  return `${dh}:${String(m).padStart(2, "0")} ${period}`
}

export default function UpcomingRide() {
  const { activeRide } = useRide()
  const [pickupName, setPickupName] = useState("Getting address…")

  const pickupLat = activeRide?.passenger?.location?.coordinates?.[1]
  const pickupLng = activeRide?.passenger?.location?.coordinates?.[0]

  // Rider's current location (start of route)
  const riderLat = activeRide?.currentLocation?.coordinates?.[1]
  const riderLng = activeRide?.currentLocation?.coordinates?.[0]

  // Distance from rider to passenger → ETA → arrival time
  const dist = (pickupLat && pickupLng && riderLat && riderLng)
    ? distKm(riderLat, riderLng, pickupLat, pickupLng)
    : null
  const etaMinutes = dist !== null ? Math.round((dist / 40) * 60) : null
  const arrivalTime = calcArrivalTime(activeRide?.departureTime, etaMinutes)

  useEffect(() => {
    if (!pickupLat || !pickupLng) { setPickupName("Your location"); return }
    reverseGeocode(pickupLat, pickupLng).then(setPickupName)
  }, [pickupLat, pickupLng])

  if (!activeRide) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col gap-6">

        <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-3xl mx-auto">
          🛵
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-1">Ride Confirmed</p>
          <h2 className="text-2xl font-bold text-gray-900">Your ride is booked</h2>
          {/* <p className="text-sm text-gray-500 mt-2">Your rider will start heading towards you soon.</p> */}
        </div>

        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-base">
              {(activeRide.riderName || "R")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{activeRide.riderName || "—"}</p>
              {activeRide.riderPhone && (
                <a href={`tel:${activeRide.riderPhone}`} className="text-xs text-blue-600">
                  📞 {activeRide.riderPhone}
                </a>
              )}
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400 flex-shrink-0">Pickup</span>
              <span className="font-medium text-gray-800 text-right">{pickupName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Destination</span>
              <span className="font-medium text-gray-800">St Aloysius College</span>
            </div>
            {arrivalTime && (
              <div className="flex justify-between">
                <span className="text-gray-400">Arriving at</span>
                <span className="font-semibold text-teal-700">{arrivalTime}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Fare</span>
              <span className="font-bold text-green-600">₹{activeRide.fare?.amount || "—"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
          <p className="text-sm text-blue-700 font-medium">
            Waiting for rider to start heading your way…
          </p>
        </div>

        <p className="text-center text-xs text-gray-400">
          You'll see live tracking once the rider starts moving
        </p>
      </div>
    </div>
  )
}
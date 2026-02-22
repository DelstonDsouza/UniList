import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

export default function PickLocation() {
  const navigate = useNavigate()
  const [currentLocation, setCurrentLocation] = useState("Fetching your location...")

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        )
        const data = await res.json()

        setCurrentLocation(data.display_name)
      },
      () => {
        setCurrentLocation("Unable to fetch location")
      }
    )
  }, [])

  return (
    <div className="fixed inset-0 bg-white slide-screen">

      {/* HEADER */}
      <div className="p-4">
        <button onClick={() => navigate(-1)} className="text-xl">←</button>
      </div>

      {/* CONTENT */}
      <div className="px-4 space-y-4">

        {/* PICKUP */}
        <div className="border rounded-xl p-4">
          <p className="text-lg font-semibold">
            {currentLocation}
          </p>
        </div>

        {/* DESTINATION FIXED */}
        <div className="border rounded-xl p-4">
          <p className="text-gray-500">Destination</p>
          <p className="font-semibold">
            St Aloysius College, Mangalore
          </p>
        </div>

      </div>
    </div>
  )
}

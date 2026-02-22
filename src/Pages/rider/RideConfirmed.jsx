import { MapContainer, TileLayer, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-routing-machine"
import "leaflet-routing-machine/dist/leaflet-routing-machine.css"
import L from "leaflet"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/* ROUTE COMPONENT */
function Routing({ userLocation, pickupLocation, destination }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(userLocation[0], userLocation[1]),
        L.latLng(pickupLocation[0], pickupLocation[1]),
        L.latLng(destination[0], destination[1])
      ],
      lineOptions: {
        styles: [{ color: "blue", weight: 6 }]
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false
    }).addTo(map)

    return () => map.removeControl(routingControl)
  }, [map])

  return null
}

export default function RideConfirmed() {

  const location = useLocation()

  const { userLocation, collegeLocation } = location.state || {}

  /* mock passenger pickup */
  const pickupLocation = [12.94, 74.84]

  const distance = "5.4 km"
  const cost = "₹120"

  return (
    <div className="min-h-screen bg-gray-100 pb-28 ride-slide">

      {/* MAP */}
      <MapContainer
        center={userLocation}
        zoom={13}
        style={{ height: "60vh", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Routing
          userLocation={userLocation}
          pickupLocation={pickupLocation}
          destination={collegeLocation}
        />
      </MapContainer>

      {/* PASSENGER CARD */}
      <div className="bg-white p-5 rounded-t-2xl shadow-md">

        <h2 className="text-xl font-semibold mb-2">
          Passenger Details
        </h2>

        <p><strong>Name:</strong> Rahul Sharma</p>
        <p><strong>Location:</strong> Kulasekara</p>
        <p><strong>Rating:</strong> ⭐ 4.8</p>

        {/* Distance & Cost */}
        <div className="flex justify-between mt-4 text-lg">
          <span>Distance: {distance}</span>
          <span className="text-green-600 font-semibold">
            Ride Cost: {cost}
          </span>
        </div>

      </div>

      {/* SWIPE TO START */}
      <div className="swipe-start">
        <div className="swipe-bar">
          Swipe to Start Ride →
        </div>
      </div>

    </div>
  )
}
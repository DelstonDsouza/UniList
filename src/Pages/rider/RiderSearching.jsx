import { MapContainer, TileLayer, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-routing-machine"
import "leaflet-routing-machine/dist/leaflet-routing-machine.css"
import L from "leaflet"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

/* ROUTE COMPONENT */
function Routing({ userLocation, collegeLocation }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !userLocation || !collegeLocation) return

    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(userLocation[0], userLocation[1]),
        L.latLng(collegeLocation[0], collegeLocation[1])
      ],
      lineOptions: {
        styles: [{ color: "blue", weight: 6 }]
      },
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false
    }).addTo(map)

    return () => map.removeControl(routingControl)
  }, [map, userLocation, collegeLocation])

  return null
}

export default function RiderSearching() {

  const location = useLocation()
  const navigate = useNavigate()
  const { userLocation, collegeLocation } = location.state || {}

  const [rideMatched, setRideMatched] = useState(false)

/* SIMULATE MATCH */
useEffect(() => {
  const searchTimer = setTimeout(() => {
    setRideMatched(true)

    setTimeout(() => {
      navigate("/ride-confirmed", {
        state: {
          userLocation,
          collegeLocation
        }
      })
    }, 2500)

  }, 4000)

  return () => clearTimeout(searchTimer)
}, [])

if (!userLocation || !collegeLocation) {
  return <div>Loading map...</div>
}

  return (
    <div className="min-h-screen bg-gray-100">

      {/* MAP */}
      <MapContainer
        center={userLocation}
        zoom={13}
        style={{ height: "65vh", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Routing
          userLocation={userLocation}
          collegeLocation={collegeLocation}
        />
      </MapContainer>

      {/* SEARCH PANEL */}
      <div className="bg-white py-12 flex flex-col items-center">

        {/* TEXT ONLY CHANGES HERE */}
        <h2 className="text-lg font-medium mb-6">
          {rideMatched ? (
            <span className="text-green-600 font-semibold">
              Ride Matched Successfully<span className="dots"></span>
            </span>
          ) : (
            "Scanning for nearby passengers"
          )}
        </h2>

        {/* Radar stays until matched */}
        {!rideMatched && (
          <div className="radar-wrapper">
            <div className="radar-svg">
              <svg viewBox="0 0 100 100">

                <circle cx="50" cy="50" r="40" className="ring" />
                <circle cx="50" cy="50" r="25" className="ring" />
                <circle cx="50" cy="50" r="10" className="ring" />

                <g className="beam-group">
                  <path
                    d="M50 50 L50 5 A45 45 0 0 1 95 50 Z"
                    className="beam"
                  />
                </g>

                <circle cx="50" cy="50" r="3" className="center" />

                <circle cx="70" cy="25" r="2" className="signal" />
                <circle cx="30" cy="70" r="2" className="signal" />
                <circle cx="80" cy="60" r="2" className="signal" />

              </svg>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
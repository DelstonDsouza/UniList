import { MapContainer, TileLayer, Marker } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import homeIcon from "../../assets/icons/home-icon.svg"
import exploreIcon from "../../assets/icons/explore-icon.svg"
import profileIcon from "../../assets/icons/profile-icon.svg"

export default function RiderHome() {
  const [userLocation, setUserLocation] = useState(null)
  const [locationName, setLocationName] = useState("Fetching location...")
  const [departureTime, setDepartureTime] = useState("")
  const [showPopup, setShowPopup] = useState(false);
  const [timeError, setTimeError] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const navigate = useNavigate()

  // FIXED COLLEGE DESTINATION
  const collegeLocation = [12.872109642876621, 74.84534749009204] // St Aloysius College Mangalore
  const collegeName = "St Aloysius College, Mangalore"

  // FETCH LIVE USER LOCATION
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setUserLocation([lat, lng])

        // reverse geocode location name
        const res = await fetch(
  `${import.meta.env.VITE_NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json`
)
        const data = await res.json()
        setLocationName(data.display_name)
      },
      () => {
        alert("Please enable location permission")
      }
    )
  }, [])

  // DISABLE PAST TIMES
  const getMinTime = () => {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, "0")
    const minutes = now.getMinutes().toString().padStart(2, "0")
    return `${hours}:${minutes}`
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button className="text-2xl">☰</button>
        <h1 className="text-lg font-semibold">Welcome, Rider !</h1>
        <div className="w-9 h-9 bg-teal-400 rounded-full" />
      </div>

      {/* MAP - STATIC PIN AT USER LOCATION */}
      <div className="mt-4 mx-4 rounded-3xl overflow-hidden shadow-sm">
        {userLocation && (
          <MapContainer
            center={userLocation}
            zoom={15}
            style={{ height: "220px", width: "100%" }}
            dragging={false}
            zoomControl={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={userLocation} />
          </MapContainer>
        )}
      </div>

        {/* PopUp confirmation */}
        {showPopup && (
  <div className="popup-overlay">
    <div className="popup-box bg-white">
      <h2>Post a ride ?</h2>

      <div className="popup-actions">
        <button
          className="cancel-btn"
          onClick={() => setShowPopup(false)}
        >
          Cancel
        </button>

        <button
          className="confirm-btn"
          onClick={() => {
            setShowPopup(false);
            navigate("/rider-searching", {
      state: {
        userLocation,
        collegeLocation
      }
    })
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}

      {/* POST RIDE CARD */}
      <div className="px-4 mt-5">
        <h2 className="font-semibold mb-3">Post a Ride</h2>

        <div
          className="p-5 rounded-2xl space-y-4 text-white"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
        >

          {/* CURRENT LOCATION */}
          <div>
            <label className="text-sm opacity-80">Current Location</label>
            <input
  value={locationName}
  readOnly
  className={`w-full p-3 rounded-lg text-black bg-white mt-1 border ${
    locationError ? "border-red-500" : "border-transparent"
  }`}
/>

{locationError && (
  <p className="text-red-500 text-xs mt-1">
    Location not available
  </p>
)}
          </div>

          {/* DESTINATION (FIXED) */}
          <div>
            <label className="text-sm opacity-80">Destination</label>
            <input
              value={collegeName}
              readOnly
              className="w-full p-3 rounded-lg text-black bg-white mt-1"
            />
          </div>

          {/* DEPARTURE TIME */}
          <div>
            <label className="text-sm opacity-80">Departure Time</label>
            <input
  type="time"
  min={getMinTime()}
  value={departureTime}
  onChange={(e) => {
    setDepartureTime(e.target.value)
    setTimeError(false)
  }}
  className={`w-full p-3 rounded-lg text-black bg-white mt-1 border ${
    timeError ? "border-red-500" : "border-transparent"
  }`}
/>

{timeError && (
  <p className="text-red-500 text-xs mt-1">
    Please select departure time
  </p>
)}
          </div>

{/* SEARCH BUTTON */}
<button
  onClick={() => {

    let hasError = false

    if (!userLocation) {
      setLocationError(true)
      hasError = true
    } else {
      setLocationError(false)
    }

    if (!departureTime) {
      setTimeError(true)
      hasError = true
    } else {
      setTimeError(false)
    }

    if (hasError) return

    setShowPopup(true)
  }}
  className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-black font-medium py-3 rounded-xl transition"
>
  Search for Passenger
</button>

        {/* SAVED RIDES */}
        <button className="mt-4 bg-gray-200 px-4 py-2 rounded-lg">
          Saved Rides
        </button>
      </div>
    </div> 
      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3">
        <div className="text-center">
          <img src={homeIcon} className="w-6 mx-auto mb-1" />
          <div className="text-sm font-medium">Home</div>
        </div>

        <div className="text-center text-gray-400">
          <img src={exploreIcon} className="w-6 mx-auto mb-1 opacity-60" />
          <div className="text-sm">History</div>
        </div>

        <div className="text-center text-gray-400">
          <img src={profileIcon} className="w-6 mx-auto mb-1 opacity-60" />
          <div className="text-sm">Account</div>
        </div>
      </div>
    </div>
  )
}

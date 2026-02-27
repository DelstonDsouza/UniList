import { useNavigate } from "react-router-dom"
import { useEffect } from "react"

export default function SelectRole() {
  const navigate = useNavigate()

  // If role already selected earlier → skip this page
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"))
    if (!user) return

    const role = localStorage.getItem(`role_${user.phone}`)

    if (role === "rider") {
      navigate("/rider-home")
    }

    if (role === "passenger") {
      navigate("/passenger-home")
    }
  }, [])

  const handleSelect = (role) => {
    const user = JSON.parse(localStorage.getItem("user"))
    if (!user) return

    // Save role per phone number
    localStorage.setItem(`role_${user.phone}`, role)

    // Navigate based on role
    if (role === "rider") {
      navigate("/rider-home")
    } else {
      navigate("/passenger-home")
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">

      {/* Title */}
      <h1 className="text-2xl font-bold mb-12 text-center">
        Select your role
      </h1>

      {/* Buttons */}
      <div className="flex gap-12">

        {/* RIDER */}
        <button
          onClick={() => handleSelect("rider")}
          className="bg-black text-white w-48 py-6 rounded-2xl text-lg font-semibold
                     transition duration-300
                     hover:shadow-[0_0_25px_rgba(0,0,0,0.7)]
                     hover:scale-105"
        >
          RIDER
        </button>

        {/* PASSENGER */}
        <button
          onClick={() => handleSelect("passenger")}
          className="bg-black text-white w-48 py-6 rounded-2xl text-lg font-semibold
                     transition duration-300
                     hover:shadow-[0_0_25px_rgba(0,0,0,0.7)]
                     hover:scale-105"
        >
          PASSENGER
        </button>

      </div>

    </div>
  )
}

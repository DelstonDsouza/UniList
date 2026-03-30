import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { apiFetch } from "../../services/api"

function RiderRegistration() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    vehicle: "",
    plate: "",
    licensePhoto: null,
  })

  const handleChange = (e) => {
    const { name, value, files } = e.target
    setForm((f) => ({ ...f, [name]: files ? files[0] : value }))
  }
  useEffect(() => {
    const raw = localStorage.getItem("user")
    const u = raw ? JSON.parse(raw) : null
    if (u && u.isRider) navigate("/giveride")
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.fullName || !form.dob || !form.vehicle || !form.plate || !form.licensePhoto) {
      toast.error("Please fill all fields and upload license photo")
      return
    }
    setLoading(true)
    try {
      await apiFetch("/rider/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseNo: form.fullName, // Using Name field as placeholder if they don't have separate DL field here
          licenseNo_actual: form.fullName,
          licenseNo: form.fullName,
          licenseNo: "KA0120190012345", // dummy for old screen
          vehicleNo: form.plate.replace(/\s/g, ""),
          vehicleType: form.vehicle.toLowerCase().includes("scoot") ? "scooter" : "bike"
        })
      })
      const raw = localStorage.getItem("user")
      const u = raw ? JSON.parse(raw) : null
      const next = { ...(u || {}), isRider: true }
      localStorage.setItem("user", JSON.stringify(next))
      toast.success("Rider profile created")
      navigate("/giveride")
    } catch (err) {
      toast.error(err.message || "Failed to save profile")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center px-6 py-12">
      {/* Hamburger */}
      <button
        className="fixed left-4 top-4 z-50 p-3 rounded-xl bg-white dark:bg-slate-800 border shadow hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => setMenuOpen((v) => !v)}
        title="Menu"
        aria-label="Menu"
      >
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white mb-1"></span>
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white mb-1"></span>
        <span className="block w-5 h-0.5 bg-slate-900 dark:bg-white"></span>
      </button>
      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 px-6 pt-16 pb-6">
            <h2 className="text-2xl font-extrabold mb-6 text-white">Menu</h2>
            <div className="space-y-0 divide-y divide-slate-700">
              <button
                onClick={() => { setMenuOpen(false); navigate("/dashboard") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                PASSENGER
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  const raw = localStorage.getItem("user")
                  const u = raw ? JSON.parse(raw) : null
                  const has = !!u && !!u.isRider
                  navigate(has ? "/giveride" : "/become-rider")
                }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                RIDER
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("History coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                HISTORY
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("Contact coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                CONTACT
              </button>
              <button
                onClick={() => { setMenuOpen(false); toast.success("Profile coming soon") }}
                className="w-full text-left px-4 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                PROFILE
              </button>

            </div>
          </aside>
        </div>
      )}
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Rider Registration
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Enter details as per your driving license
        </p>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <input
            name="fullName"
            placeholder="Name as per license"
            required
            value={form.fullName}
            onChange={handleChange}
            className="w-full rounded-xl px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          />
          <input
            type="date"
            name="dob"
            required
            value={form.dob}
            onChange={handleChange}
            className="w-full rounded-xl px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          />
          <input
            name="vehicle"
            placeholder="Bike/Scooter (Model)"
            required
            value={form.vehicle}
            onChange={handleChange}
            className="w-full rounded-xl px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          />
          <input
            name="plate"
            placeholder="Number Plate"
            required
            value={form.plate}
            onChange={handleChange}
            className="w-full rounded-xl px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              License Photo Upload
            </label>
            <input
              type="file"
              accept="image/*"
              required
              name="licensePhoto"
              onChange={handleChange}
              className="w-full rounded-xl px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? "Saving..." : "Create Rider Profile"}
          </button>
        </form>
      </div>
    </main>
  )
}

export default RiderRegistration

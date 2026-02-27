import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"

function BecomeRider() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const raw = localStorage.getItem("user")
    const u = raw ? JSON.parse(raw) : null
    if (u && u.isRider) navigate("/giveride")
  }, [navigate])
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
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Want to become a rider?
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Share your ride by offering a seat on your bike/scooter for college commutes.
        </p>

        <div className="w-40 h-40 mx-auto mb-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-5xl">
          🛵
        </div>

        <button
          onClick={() => navigate("/rider-registration")}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
        >
          Become a Rider
        </button>
      </div>
    </main>
  )
}

export default BecomeRider

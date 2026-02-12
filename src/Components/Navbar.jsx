import { Link, NavLink } from "react-router-dom"
import { useState } from "react"
import ThemeToggle from "./ui/toggle"

function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl">
      <div className="backdrop-blur-md bg-white/80 dark:bg-slate-900/80
                      shadow-lg rounded-2xl px-6 py-3
                      flex items-center justify-between">

        {/* LOGO */}
        <Link
          to="/"
          className="text-xl font-extrabold text-slate-900 dark:text-white"
        >
          Kozhi<span className="text-blue-600">Go</span>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-6">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? "text-blue-600 font-medium"
                : "text-slate-700 dark:text-slate-300 hover:text-blue-600 font-medium"
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/login"
            className="text-slate-700 dark:text-slate-300 hover:text-blue-600 font-medium"
          >
            Login
          </NavLink>

          <NavLink
            to="/register"
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Get Started
          </NavLink>

          {/* THEME TOGGLE */}
          <ThemeToggle />
        </div>

        {/* MOBILE */}
        <div className="md:hidden relative">
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              aria-label="Open menu"
              onClick={() => setOpen((v) => !v)}
              className="text-2xl text-slate-800 dark:text-white"
            >
              ☰
            </button>
          </div>
          {open && (
            <div className="absolute right-0 mt-3 w-48 rounded-xl border bg-white dark:bg-slate-900 shadow-xl p-3">
              <nav className="grid gap-2">
                <NavLink
                  to="/"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Home
                </NavLink>
                <NavLink
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Get Started
                </NavLink>
              </nav>
            </div>
          )}
        </div>

      </div>
    </nav>
  )
}

export default Navbar

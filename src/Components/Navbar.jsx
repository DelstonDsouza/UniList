import { Link, NavLink } from "react-router-dom"
import ThemeToggle from "./ui/toggle"

function Navbar() {
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
        <div className="md:hidden flex items-center gap-3">
          <ThemeToggle />
          <button className="text-2xl text-slate-800 dark:text-white">☰</button>
        </div>

      </div>
    </nav>
  )
}

export default Navbar

import { Link } from "react-router-dom"

function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-6 py-16 grid gap-10 md:grid-cols-4">

        {/* BRAND */}
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-4">
            Kozhi<span className="text-blue-500">Go</span>
          </h2>
          <p className="text-sm leading-relaxed">
            KozhiGo is a student-focused ride-sharing platform designed to
            reduce travel costs, traffic congestion, and fuel wastage in
            Kozhikode.
          </p>
        </div>

        {/* QUICK LINKS */}
        <div>
          <h3 className="text-white font-semibold mb-4">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-white transition">Home</Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-white transition">Login</Link>
            </li>
            <li>
              <Link to="/register" className="hover:text-white transition">Register</Link>
            </li>
          </ul>
        </div>

        {/* FEATURES */}
        <div>
          <h3 className="text-white font-semibold mb-4">Features</h3>
          <ul className="space-y-2 text-sm">
            <li>Student Ride Sharing</li>
            <li>Cost Saving Commute</li>
            <li>Eco-Friendly Travel</li>
            <li>College-Based Matching</li>
          </ul>
        </div>

        {/* LOCATION */}
        <div>
          <h3 className="text-white font-semibold mb-4">Location</h3>
          <p className="text-sm">
            Built for students in<br />
            <span className="text-white font-medium">
              Kozhikode, Kerala
            </span>
          </p>
        </div>

      </div>

      {/* BOTTOM BAR */}
      <div className="border-t border-slate-700 py-6 text-center text-sm">
        © {new Date().getFullYear()} KozhiGo. All rights reserved.
      </div>
    </footer>
  )
}

export default Footer

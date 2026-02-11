import { Link } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import CanvasParticles from "../../Components/ui/SectionPattern"

function Hero() {
  const [visible, setVisible] = useState(false)
  const heroRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.3 }
    )

    if (heroRef.current) observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden bg-slate-900 text-white min-h-screen"
    >
      {/* 🟢 Canvas Particles */}
      <CanvasParticles />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-28 grid md:grid-cols-2 gap-14 items-center">

        {/* LEFT CONTENT */}
        <div
          className={`transition-all duration-700 ease-out
          ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            Smarter Student{" "}
            <span className="text-blue-500">Ride Sharing</span>
            <br /> for Daily Commute
          </h1>

          <p className="text-slate-300 text-lg mb-8 max-w-xl">
            KozhiGo connects nearby students traveling to the same college,
            helping reduce travel costs, traffic congestion, and fuel wastage.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 transition px-7 py-3 rounded-md font-semibold"
            >
              Get Started
            </Link>

            <Link
              to="/login"
              className="border border-slate-400 hover:bg-white hover:text-slate-900 transition px-7 py-3 rounded-md font-semibold"
            >
              Login
            </Link>
          </div>
        </div>

        {/* RIGHT SIDE — DEMO VIDEO */}
        <div
          className={`transition-all duration-700 delay-150 ease-out
          ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}
        >
          <div className="relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            <video
              src="/demo.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-64 md:h-72 object-cover"
            />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          </div>
        </div>

      </div>
    </section>
  )
}

export default Hero

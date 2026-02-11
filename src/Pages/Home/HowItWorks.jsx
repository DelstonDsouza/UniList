import { useEffect, useRef, useState } from "react"
import { FaUserPlus, FaMapMarkedAlt, FaHandshake, FaCar } from "react-icons/fa"
import ThreeDFeatureCard from "../../Components/ui/ThreeDFeatureCard"
import SectionPattern from "../../Components/ui/SectionPattern"

function HowItWorks() {
  const sectionRef = useRef(null)
  const [visible, setVisible] = useState(false)

  // 👀 Trigger slide-in when section enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.25 }
    )

    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24 bg-slate-50 dark:bg-slate-900"
    >
      {/* 🌀 Background Pattern */}
      <SectionPattern />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">

        {/* Heading */}
        <h2
          className={`text-3xl font-bold text-center text-slate-900 dark:text-white mb-4
          transition-all duration-700
          ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          How KozhiGo Works
        </h2>

        <p
          className={`text-center text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-16
          transition-all duration-700 delay-100
          ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          Start sharing rides in just four simple steps.
        </p>

        {/* Steps */}
        <div className="grid gap-14 sm:grid-cols-2 lg:grid-cols-4 place-items-center">

          {/* STEP 1 */}
          <div
            className={`transition-all duration-700 delay-150
            ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
          >
            <ThreeDFeatureCard
              step="1"
              icon={<FaUserPlus />}
              title="Sign Up"
              description="Register using your college details."
            />
          </div>

          {/* STEP 2 */}
          <div
            className={`transition-all duration-700 delay-250
            ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}
          >
            <ThreeDFeatureCard
              step="2"
              icon={<FaMapMarkedAlt />}
              title="Set Route"
              description="Enter your pickup point and college."
            />
          </div>

          {/* STEP 3 */}
          <div
            className={`transition-all duration-700 delay-350
            ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
          >
            <ThreeDFeatureCard
              step="3"
              icon={<FaHandshake />}
              title="Match"
              description="Get matched with nearby students."
            />
          </div>

          {/* STEP 4 */}
          <div
            className={`transition-all duration-700 delay-450
            ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}
          >
            <ThreeDFeatureCard
              step="4"
              icon={<FaCar />}
              title="Ride Together"
              description="Share rides and save money."
            />
          </div>

        </div>
      </div>
    </section>
  )
}

export default HowItWorks

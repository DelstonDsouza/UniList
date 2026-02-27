import { useEffect, useRef, useState } from "react"
import { FaRupeeSign, FaTrafficLight, FaLeaf } from "react-icons/fa"
import SectionPattern from "../../components/ui/SectionPattern"

function Benefits() {
  const sectionRef = useRef(null)
  const [visible, setVisible] = useState(false)

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
      className="relative overflow-hidden py-24 bg-white dark:bg-slate-950"
    >
      {/* Subtle background pattern */}
      <SectionPattern />

      <div className="relative z-10 max-w-7xl mx-auto px-6">

        {/* Heading */}
        <h2
          className={`text-3xl font-bold text-center text-slate-900 dark:text-white mb-4
          transition-all duration-700
          ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          Why It Matters
        </h2>

        <p
          className={`text-center text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-16
          transition-all duration-700 delay-100
          ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          KozhiGo isnΓÇÖt just about rides ΓÇö itΓÇÖs about smarter cities,
          affordable student life, and a cleaner future.
        </p>

        {/* Benefits */}
        <div className="grid gap-10 md:grid-cols-3 place-items-center">

          {/* Benefit 1 */}
          <div
            className={`group rounded-2xl border border-slate-200 dark:border-slate-800
            bg-white dark:bg-slate-900 p-10 text-center
            hover:shadow-xl transition-all duration-500
            ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
          >
            <div className="text-blue-600 text-4xl mb-6 flex justify-center">
              <FaRupeeSign />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Save Money
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Share fuel costs and reduce your daily commute expenses
              without compromising comfort.
            </p>
          </div>

          {/* Benefit 2 */}
          <div
            className={`group rounded-2xl border border-slate-200 dark:border-slate-800
            bg-white dark:bg-slate-900 p-10 text-center
            hover:shadow-xl transition-all duration-500 delay-150
            ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          >
            <div className="text-blue-600 text-4xl mb-6 flex justify-center">
              <FaTrafficLight />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Reduce Traffic
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Fewer vehicles on the road means smoother traffic
              and less stress during peak hours.
            </p>
          </div>

          {/* Benefit 3 */}
          <div
            className={`group rounded-2xl border border-slate-200 dark:border-slate-800
            bg-white dark:bg-slate-900 p-10 text-center
            hover:shadow-xl transition-all duration-500 delay-300
            ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}
          >
            <div className="text-green-600 text-4xl mb-6 flex justify-center">
              <FaLeaf />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Help the Environment
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Lower emissions, reduced fuel usage, and a positive
              impact on the environment.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}

export default Benefits

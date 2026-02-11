import FeatureCard from "../../Components/ui/AnimatedCard"
import { FaMapMarkerAlt, FaUserGraduate, FaLeaf } from "react-icons/fa"
import SectionPattern from "../../Components/ui/SectionPattern"

function Features() {
  return (
    <section className="relative overflow-hidden py-24 bg-slate-50 dark:bg-slate-900">
      
      {/* Background Pattern */}
      <SectionPattern />

      {/* Content Layer */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">

        {/* Heading */}
        <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-4">
          Why KozhiGo?
        </h2>

        <p className="text-center text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-16">
          KozhiGo helps students commute smarter by connecting nearby peers,
          reducing costs, traffic, and environmental impact.
        </p>

        {/* Feature Cards */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 place-items-center">

          <FeatureCard
            icon={<FaMapMarkerAlt />}
            title="Nearby Matching"
            description="Instantly find students near your pickup location who travel the same route."
          />

          <FeatureCard
            icon={<FaUserGraduate />}
            title="College-Based Rides"
            description="Ride only with verified students from your own college for safety and trust."
          />

          <FeatureCard
            icon={<FaLeaf />}
            title="Save Money & Environment"
            description="Split fuel costs, reduce traffic congestion, and lower carbon emissions."
          />

        </div>
      </div>
    </section>
  )
}

export default Features

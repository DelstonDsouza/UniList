import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, IndianRupee, MapPin, Users, ChevronRight, ChevronLeft } from "lucide-react";
import bgImage from "../../assets/images/bg.png";

const steps = [
  {
    tag: "Student Verified",
    title: "Only for our campus community.",
    description:
      "UniLift is exclusively for verified students. Sign up with your college email or college id and ride with people you already share a campus with.",
    icon: <ShieldCheck size={28} className="text-teal-600" />,
  },
  {
    tag: "Cost Sharing",
    title: "Split the petrol, not your wallet.",
    description:
      "No surge pricing. No profit margins. Everyone pays their fair share.",
    icon: <IndianRupee size={28} className="text-teal-600" />,
  },
  {
    tag: "Live Tracking",
    title: "Know where your ride is.",
    description:
      "Track your ride in real time and never wait blindly again.",
    icon: <MapPin size={28} className="text-teal-600" />,
  },
  {
    tag: "Safe & Social",
    title: "Commute better, together.",
    description:
      "Ride with fellow students and build a trusted network.",
    icon: <Users size={28} className="text-teal-600" />,
  },
];

function Home() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("onboarding_seen");
    const user = localStorage.getItem("user");
    if (seen || user) {
      navigate("/login", { replace: true });
    } else {
      setReady(true);
    }
  }, []);

  const markSeenAndGo = (path) => {
    localStorage.setItem("onboarding_seen", "true");
    navigate(path);
  };

  if (!ready) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen flex flex-col relative">

      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      />

      {/* LIGHT overlay (not washed) */}
      <div className="absolute inset-0 bg-white/60" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">

        {/* NAV */}
        <nav className="w-full max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold">
              U
            </div>
            <span className="font-bold text-lg">UniLift</span>
          </div>

          <button
            onClick={() => markSeenAndGo("/login")}
            className="text-sm text-gray-500 hover:text-teal-600"
          >
            Skip →
          </button>
        </nav>

        {/* MAIN */}
        <main className="flex-1 flex items-center justify-center md:justify-end px-6 md:px-16">

          <div className="w-full max-w-lg">

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-xl p-6 md:p-8"
              >

                {/* TAG */}
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 bg-teal-100 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                  {current.tag}
                </span>

                {/* STEP */}
                <p className="text-xs text-gray-400 mt-3">
                  {String(step + 1).padStart(2, "0")} / {steps.length}
                </p>

                {/* TITLE */}
                <h1 className="text-3xl md:text-4xl font-bold mt-2 text-gray-900">
                  {current.title}
                </h1>

                {/* DESC */}
                <p className="text-gray-600 mt-3 text-sm md:text-base">
                  {current.description}
                </p>

                {/* DOTS */}
                <div className="flex gap-2 mt-5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full ${i === step ? "w-6 bg-teal-600" : "w-2 bg-gray-300"
                        }`}
                    />
                  ))}
                </div>

                {/* BUTTONS */}
                <div className="flex items-center gap-3 mt-6">

                  {step > 0 && (
                    <button
                      onClick={() => setStep(step - 1)}
                      className="w-10 h-10 flex items-center justify-center border rounded-lg"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}

                  <button
                    onClick={() =>
                      isLast ? markSeenAndGo("/register") : setStep(step + 1)
                    }
                    className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-teal-700"
                  >
                    {isLast ? "Get Started" : "Next"}
                    <ChevronRight size={16} />
                  </button>

                </div>

              </motion.div>
            </AnimatePresence>

          </div>
        </main>

        {/* FOOTER */}
        <footer className="text-center py-6 text-xs text-gray-400">
          UniLift · Student Ride Sharing
        </footer>

      </div>
    </div>
  );
}

export default Home;
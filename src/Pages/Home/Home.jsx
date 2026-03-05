import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, IndianRupee, MapPin, Users, ArrowRight, ChevronRight, ChevronLeft } from "lucide-react";

const steps = [
  {
    tag: "Student Verified",
    title: "Only for our campus community.",
    description: "UniLift is exclusively for verified students. Sign up with your college email and ride with people you already share a campus with.",
    icon: <ShieldCheck size={32} strokeWidth={1.5} className="text-teal-600" />,
    bg: "bg-teal-50",
    iconBg: "bg-teal-100",
  },
  {
    tag: "Cost Sharing",
    title: "Split the petrol, not your wallet.",
    description: "No surge pricing. No profit margins. UniLift auto-calculates a fair share of petrol costs based on distance so everyone pays exactly their part.",
    icon: <IndianRupee size={32} strokeWidth={1.5} className="text-teal-600" />,
    bg: "bg-emerald-50",
    iconBg: "bg-emerald-100",
  },
  {
    tag: "Live Tracking",
    title: "Know where your ride is.",
    description: "Track your driver in real-time on the map. Get notified when they're nearby so you're never left waiting or guessing.",
    icon: <MapPin size={32} strokeWidth={1.5} className="text-teal-600" />,
    bg: "bg-cyan-50",
    iconBg: "bg-cyan-100",
  },
  {
    tag: "Safe & Social",
    title: "Commute better, together.",
    description: "Build a reliable commute network with fellow students. Reduce traffic, cut costs, and turn your daily ride into something worth looking forward to.",
    icon: <Users size={32} strokeWidth={1.5} className="text-teal-600" />,
    bg: "bg-sky-50",
    iconBg: "bg-sky-100",
  },
];

function Home() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // If already seen onboarding OR already logged in → skip to login
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

  // Don't flash the page before redirect
  if (!ready) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-teal-600 selection:text-white">

      {/* Nav */}
      <nav className="w-full max-w-5xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">U</span>
          </div>
          <span className="text-[#111] font-bold text-lg tracking-tight">UniLift</span>
        </div>
        <button
          onClick={() => markSeenAndGo("/login")}
          className="text-xs text-gray-400 hover:text-teal-600 font-medium transition-colors"
        >
          Skip →
        </button>
      </nav>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="grid md:grid-cols-2 gap-10 items-center"
            >
              {/* Visual Card */}
              <div className="hidden md:flex justify-center">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className={`w-72 h-72 ${current.bg} rounded-3xl flex items-center justify-center border border-gray-100 shadow-sm`}
                >
                  <div className={`w-20 h-20 ${current.iconBg} rounded-2xl flex items-center justify-center`}>
                    {current.icon}
                  </div>
                </motion.div>
              </div>

              {/* Text Content */}
              <div className="flex flex-col gap-6">
                <span className="inline-flex items-center gap-1.5 w-fit px-3 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full border border-teal-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
                  {current.tag}
                </span>

                <p className="text-xs text-gray-400 font-medium -mb-2">
                  {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                </p>

                <h1 className="text-4xl md:text-5xl font-bold text-[#111] leading-[1.1] tracking-tight">
                  {current.title}
                </h1>

                <p className="text-gray-500 text-base md:text-lg leading-relaxed max-w-sm">
                  {current.description}
                </p>

                {/* Dots */}
                <div className="flex items-center gap-2">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === step ? "w-6 bg-teal-600" : "w-1.5 bg-gray-200 hover:bg-gray-300"
                      }`}
                    />
                  ))}
                </div>

                {/* Actions */}
                {isLast ? (
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={() => markSeenAndGo("/register")}
                      className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm py-3 px-7 rounded-xl transition-colors shadow-sm"
                    >
                      Get Started
                      <ArrowRight size={16} />
                    </button>
                    <button
                      onClick={() => markSeenAndGo("/login")}
                      className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm py-3 px-7 rounded-xl transition-colors border border-gray-200"
                    >
                      Sign In
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pt-2">
                    {step > 0 && (
                      <button
                        onClick={() => setStep(step - 1)}
                        className="flex items-center justify-center w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors border border-gray-200"
                      >
                        <ChevronLeft size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => setStep(step + 1)}
                      className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm py-3 px-7 rounded-xl transition-colors shadow-sm"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="py-8 text-center">
        <p className="text-[11px] text-gray-300 font-medium tracking-widest uppercase">
          UniLift · Student Ride Sharing
        </p>
      </footer>
    </div>
  );
}

export default Home;
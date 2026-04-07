import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { ArrowLeft, Upload, FileImage } from "lucide-react"
import { apiFetch } from "../../services/api"

export default function RaiseTicket() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [complaintType, setComplaintType] = useState("Past Ride Related")
  const [rideId, setRideId] = useState("")
  const [against, setAgainst] = useState("")
  const [complaint, setComplaint] = useState("")
  const [attachment, setAttachment] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  
  const [pastRides, setPastRides] = useState([])
  const [loadingRides, setLoadingRides] = useState(false)
  const [profile, setProfile] = useState(null)

  const isRiderSide = location.state?.from === "/rider-home"

  useEffect(() => {
    // Fetch profile to know userId
    apiFetch("/auth/me").then(data => {
      const p = data.user || data
      setProfile(p)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (complaintType === "Past Ride Related" && profile) {
      fetchHistory(profile._id)
    }
  }, [complaintType, profile, isRiderSide])

  const fetchHistory = async (userId) => {
    setLoadingRides(true)
    try {
      const queryKey = isRiderSide ? "riderId" : "passengerId"
      const res = await apiFetch(`/rides/history?${queryKey}=${userId}&days=7`)
      const arr = res?.data?.rides || res?.rides
      setPastRides(Array.isArray(arr) ? arr : [])
    } catch {
      toast.error("Failed to load past rides")
    } finally {
      setLoadingRides(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast.error("File must be less than 5MB")

    const reader = new FileReader()
    reader.onload = () => {
      setAttachment(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!complaint.trim()) return toast.error("Please describe your complaint")
    if (complaintType === "Past Ride Related" && !rideId) return toast.error("Please select a past ride")

    setSubmitting(true)
    try {
      await apiFetch("/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintType,
          complaint,
          against: against.trim(),
          rideId: complaintType === "Past Ride Related" ? rideId : undefined,
          attachment
        })
      })
      toast.success("Ticket submitted successfully!")
      setTimeout(() => {
        if (location.state?.from) {
          navigate(location.state.from, { state: location.state })
        } else {
          navigate(-1)
        }
      }, 1000)
    } catch (error) {
      toast.error(error.message || "Failed to submit ticket")
    } finally {
      setSubmitting(false)
    }
  }

  const complaintOptions = ["Past Ride Related", "Pricing & Refund Related", "Technical Related", "Other Related"]

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col font-sans">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 h-16 flex items-center gap-3">
          <button 
            onClick={() => {
              if (location.state?.from) {
                navigate(location.state.from, { state: location.state })
              } else {
                navigate(-1)
              }
            }} 
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Raise Ticket</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Type */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">Type of Issue</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {complaintOptions.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setComplaintType(opt)}
                    className={`p-3 rounded-xl border text-sm font-semibold text-left transition-all ${
                      complaintType === opt 
                        ? "border-teal-500 bg-teal-50 text-teal-700 shadow-[0_0_0_2px_rgba(20,184,166,0.2)]" 
                        : "border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-gray-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Ride Selection */}
            {complaintType === "Past Ride Related" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">Select Ride</label>
                {loadingRides ? (
                  <div className="p-3 bg-gray-100 rounded-xl animate-pulse h-12 w-full"></div>
                ) : (
                  <select 
                    value={rideId} 
                    onChange={e => {
                      const id = e.target.value
                      setRideId(id)
                      const r = pastRides.find(x => x._id === id)
                      if (r) {
                        const otherName = isRiderSide ? r.passenger?.name : r.riderName
                        setAgainst(otherName || "")
                      }
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition text-gray-900 font-medium text-[15px] appearance-none"
                  >
                    <option value="" disabled>Choose a recent ride...</option>
                    {pastRides.length === 0 && <option disabled>No rides in the last 7 days</option>}
                    {pastRides.map(r => {
                      const dateObj = new Date(r.createdAt)
                      const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                      const otherParty = isRiderSide ? `Passenger: ${r.passenger?.name || "User"}` : `Rider: ${r.riderName || "User"}`
                      
                      return (
                        <option key={r._id} value={r._id}>
                          {dateStr} | {timeStr} | {otherParty}
                        </option>
                      )
                    })}
                  </select>
                )}
              </motion.div>
            )}

            {/* Against */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">Complaint Against (Optional)</label>
              <input 
                type="text" 
                value={against}
                onChange={e => setAgainst(e.target.value)}
                placeholder="Name or details of the person"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition text-gray-900 placeholder-gray-400 font-medium text-[15px]"
              />
            </div>

            {/* Complaint Text */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">Description</label>
              <textarea 
                value={complaint}
                onChange={e => setComplaint(e.target.value)}
                placeholder="Please describe the issue in detail..."
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition text-gray-900 placeholder-gray-400 font-medium text-[15px] resize-none"
              />
            </div>

            {/* Attachment */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">Attachment (Optional)</label>
              <div className="relative">
                <input 
                  type="file" 
                  id="attachmentUpload" 
                  accept="image/*,.pdf" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <label 
                  htmlFor="attachmentUpload" 
                  className="flex items-center gap-3 w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer hover:bg-gray-100 transition focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
                    {attachment ? <FileImage className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {attachment ? "Attachment added" : "Upload File"}
                    </p>
                    <p className="text-xs text-gray-500">Image or PDF (Max 5MB)</p>
                  </div>
                  {attachment && (
                    <button 
                      type="button" 
                      onClick={(e) => { e.preventDefault(); setAttachment(null) }} 
                      className="text-red-500 text-xs font-bold uppercase tracking-wider hover:bg-red-50 px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  )}
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold tracking-wide active:scale-[0.98] transition-transform disabled:opacity-50 mt-4 shadow-md hover:bg-black"
            >
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>

          </form>
        </motion.div>
      </div>
    </div>
  )
}

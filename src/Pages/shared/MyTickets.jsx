import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Clock, MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react"
import { apiFetch } from "../../services/api"
import toast from "react-hot-toast"

export default function MyTickets() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTickets()
  }, [])

  const loadTickets = async () => {
    try {
      setLoading(true)
      const res = await apiFetch("/complaints")
      setTickets(res.complaints || [])
    } catch (err) {
      toast.error("Failed to load your tickets")
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from, { 
        state: { 
          tab: location.state.tab, 
          accountView: location.state.accountView 
        } 
      })
    } else {
      navigate(-1)
    }
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case "resolved":
        return { color: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-200", icon: CheckCircle2, text: "Resolved" }
      case "in_review":
        return { color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-200", icon: AlertCircle, text: "In Review" }
      default:
        return { color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-200", icon: Clock, text: "Pending" }
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col font-sans">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition">
              <ArrowLeft className="w-6 h-6 text-gray-800" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">My Tickets</h1>
          </div>
          <button 
            onClick={() => {
              if (location.state?.from) {
                navigate("/raise-ticket", { state: location.state })
              } else {
                navigate("/raise-ticket")
              }
            }}
            className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition"
          >
            + New Ticket
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <MessageSquare className="w-16 h-16 text-gray-200 mb-4" />
            <p className="font-medium text-gray-500 text-center">You haven't opened any support tickets yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket, i) => {
              const status = getStatusConfig(ticket.status)
              const StatusIcon = status.icon

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.05 }}
                  key={ticket._id} 
                  className="bg-white p-5 rounded-[20px] shadow-sm border border-gray-200 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-gray-900 text-base">{ticket.complaintType}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-medium">{new Date(ticket.createdAt).toLocaleDateString()} at {new Date(ticket.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-[11px] tracking-wide uppercase ${status.bg} ${status.color} ${status.border}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.text}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                    <p className="text-[13px] text-gray-700 leading-relaxed font-medium">{ticket.complaint}</p>
                  </div>

                  {ticket.adminResponse && (
                    <div className="mt-2 bg-teal-50/50 border border-teal-100 p-4 rounded-xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-teal-600 mb-1.5">Support Response</p>
                      <p className="text-[14px] font-medium text-gray-800">{ticket.adminResponse}</p>
                    </div>
                  )}

                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

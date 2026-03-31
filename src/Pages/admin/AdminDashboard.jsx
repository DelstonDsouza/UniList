import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { API_BASE, getToken } from "../../services/api"
import toast from "react-hot-toast"

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("Overview")

  // States
  const [users, setUsers] = useState([])
  const [rides, setRides] = useState([])
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (localStorage.getItem("isAdmin") !== "true") {
      navigate("/admin/login")
    }
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem("isAdmin")
    localStorage.removeItem("token")
    navigate("/admin/login")
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const token = getToken()
      
      const [resUsers, resRides, resComplaints] = await Promise.all([
        fetch(`${API_BASE}/admin/users`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_BASE}/admin/rides`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_BASE}/admin/complaints`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      ]);

      if (resUsers.ok) {
        const dataUsr = await resUsers.json();
        setUsers(dataUsr?.users || []);
      } else {
        const fallback = await fetch(`${API_BASE}/debug/users`);
        if (fallback.ok) { const fallbackData = await fallback.json(); setUsers(fallbackData?.users || []); }
      }

      if (resRides.ok) {
        const dataRide = await resRides.json();
        setRides(dataRide?.rides || []);
      }

      if (resComplaints.ok) {
        const dataComp = await resComplaints.json();
        setComplaints(dataComp?.complaints || []);
      }
    } catch {
      toast.error("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const tabs = [
    "Overview", "View Users", "Reports", "Ride Activity", "Change Fuel Cost", "Moderation"
  ]

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (u.firstName || "").toLowerCase().includes(q) ||
      (u.lastName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.universityId || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-[100dvh] bg-[#fdfafb] font-sans pb-20">
      {/* ── HEADER & TABS ── */}
      <div className="bg-[#fdfafb] sticky top-0 z-50 pt-5 px-6 pb-2">
        <div className="max-w-[1400px] mx-auto bg-white rounded-[24px] p-4 lg:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="shrink-0 flex items-center justify-between xl:justify-start gap-6 w-full xl:w-auto">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-tight">RideMate</h1>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#a10d18] mt-1">Admin Console</p>
            </div>
            <button 
              onClick={handleLogout}
              className="xl:hidden px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
            >
              Logout
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth w-full xl:w-auto">
            {tabs.map(tab => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap px-5 py-[11px] rounded-[14px] text-sm font-bold transition-all ${isActive ? "bg-[#a10d18] text-white shadow-lg shadow-red-900/20 scale-[1.02]" : "text-gray-800 hover:text-[#a10d18] hover:bg-red-50"
                    }`}
                >
                  {tab}
                </button>
              )
            })}
            <button 
              onClick={handleLogout}
              className="hidden xl:block ml-4 px-5 py-[11px] rounded-[14px] border border-gray-200 text-sm font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 pt-6 space-y-4">

        {/* TAB CONTENTS */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="space-y-4"
          >

            {activeTab === "Overview" && (
              <>
                {/* HERO TITLE */}
                <div className="bg-white rounded-[24px] p-6 lg:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#a10d18]"></div>
                  <p className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-[#a10d18]/50 mb-3">Workspace</p>
                  <h2 className="text-[32px] md:text-[40px] font-bold text-gray-900 tracking-tight leading-none mb-4 uppercase">
                    RideMate <span className="text-[#a10d18] font-black">Admin Dashboard</span>
                  </h2>
                  <p className="text-gray-500 font-medium text-[15px] lg:text-[17px]">Monitor riders, passengers, ride activity, reports, moderation, and pricing in one place.</p>
                  <button
                    onClick={loadData}
                    disabled={loading}
                    className="mt-8 bg-[#a10d18] text-white px-7 py-3.5 rounded-[14px] text-[15px] font-bold hover:bg-black transition-all shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    {loading ? "Refreshing..." : "Refresh Data"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                  <MetricCard title="Total Users" value={users.length || "0"} />
                  <MetricCard title="Active Rides" value={rides.filter(r => ["pending", "locked", "pickup_started", "ongoing"].includes(r.status)).length.toString()} />
                  <MetricCard title="Open Reports" value={complaints.filter(c => c.status !== 'resolved').length.toString()} />
                  <MetricCard title="Disabled Users" value={"0"} />
                </div>

                <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-wrap justify-between items-center gap-4 mt-2">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Latest Complaints</h3>
                    <p className="text-[15px] text-gray-500 mt-1 font-medium">{complaints.length > 0 ? `${complaints.length} complaints filed.` : "No complaints filed yet."}</p>
                  </div>
                  <button onClick={() => setActiveTab("Reports")} className="text-sm font-bold text-[#a10d18] hover:underline">Open Reports</button>
                </div>

                <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Recent Ride Activity</h3>
                    <p className="text-[15px] text-gray-500 mt-1 font-medium">{rides.length > 0 ? `${rides.length} rides recorded.` : "No rides found."}</p>
                  </div>
                  <button onClick={() => setActiveTab("Ride Activity")} className="text-sm font-bold text-[#a10d18] hover:underline">View Rides</button>
                </div>
              </>
            )}

            {activeTab === "View Users" && (
              <div className="space-y-4">
                <div className="bg-white border border-gray-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">Registered Users</h3>
                    <span className="bg-gray-50 text-gray-500 px-3.5 py-1.5 rounded-xl text-sm font-bold border border-gray-200">{filteredUsers.length}</span>
                  </div>

                  <input
                    type="text"
                    placeholder="Search by name, email, phone, or university ID"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#a10d18]/20 focus:border-[#a10d18] transition text-gray-900 placeholder-gray-400 font-medium text-[15px]"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />

                  {filteredUsers.length === 0 ? (
                    <p className="text-[15px] text-gray-500 font-medium mt-8 pb-4 pl-2">No users match this search.</p>
                  ) : (
                    <div className="mt-8 space-y-3">
                      {filteredUsers.map(u => (
                        <div key={u.uid} className="flex flex-col sm:flex-row justify-between sm:items-center border border-gray-100 bg-gray-50/50 rounded-2xl p-5 hover:border-red-200 hover:bg-white hover:shadow-md transition-all cursor-pointer gap-4">
                          <div>
                            <p className="font-extrabold text-gray-900 text-[17px]">{u.firstName} {u.lastName}</p>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[13px] text-gray-500 font-medium mt-1.5">
                              <span className="font-semibold text-gray-700">{u.email}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>{u.phone}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="uppercase text-[11px] font-bold tracking-widest text-gray-400">{u.universityId}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <span className={`text-[11px] px-3 py-1.5 rounded-xl uppercase tracking-wider font-extrabold ${u.isRider ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                              {u.isRider ? "Rider" : "Passenger"}
                            </span>
                            <span className={`text-[11px] px-3 py-1.5 rounded-xl uppercase tracking-wider font-extrabold ${u.verified ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {u.verified ? "Verified" : "Unverified"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-100 rounded-[24px] p-6 lg:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                  <p className="text-[15px] text-gray-500 font-medium">Select a user to view complete profile, rides, and moderation actions.</p>
                </div>
              </div>
            )}

            {activeTab === "Reports" && (
              <FilterableList title="User Complaints & Reports" filters={["All", "Pending", "Resolved"]} emptyMsg="No complaints found for this filter." items={complaints} type="reports" onRefresh={loadData} />
            )}

            {activeTab === "Ride Activity" && (
              <FilterableList title="Ride Activity Monitor" filters={["All", "Pending", "Accepted", "Ongoing", "Completed"]} emptyMsg="No rides found for this status." items={rides} type="rides" />
            )}

            {activeTab === "Change Fuel Cost" && (
              <div className="bg-white border border-gray-100 rounded-[24px] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-center py-24">
                <p className="text-gray-500 font-medium text-[17px]">Pricing & Fuel Cost modification coming soon.</p>
              </div>
            )}

            {activeTab === "Moderation" && (
              <div className="bg-white border border-gray-100 rounded-[24px] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-center py-24">
                <p className="text-gray-500 font-medium text-[17px]">Moderation tools coming soon.</p>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  )
}

function MetricCard({ title, value }) {
  return (
    <div className="bg-white rounded-[24px] p-6 lg:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-[#a10d18]/50 mb-1">{title}</h3>
      <p className="text-[36px] font-black text-gray-900 tracking-tight leading-none">{value}</p>
    </div>
  )
}

function FilterableList({ title, filters, emptyMsg, items = [], type = "", onRefresh }) {
  const [active, setActive] = useState(filters[0])
  const [responseTexts, setResponseTexts] = useState({})

  const submitResponse = async (id, status) => {
    try {
      const text = responseTexts[id]
      if (!text) return toast.error("Response text is required")
      const token = getToken()

      const res = await fetch(`${API_BASE}/admin/complaints/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json", 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify({ adminResponse: text, status })
      })
      if (!res.ok) throw new Error("Update failed")
      
      toast.success("Complaint updated")
      setResponseTexts(prev => ({...prev, [id]: ""}))
      if (onRefresh) onRefresh()
    } catch {
      toast.error("Failed to update complaint")
    }
  }
  
  const filtered = items.filter(item => {
    if (active === "All") return true;
    if (type === "rides") {
      if (active === "Pending") return item.status === "pending"
      if (active === "Accepted") return ["locked", "pickup_started"].includes(item.status)
      if (active === "Ongoing") return item.status === "ongoing"
      if (active === "Completed") return item.status === "completed"
    }
    if (type === "reports") {
      if (active === "Pending") return item.status === "pending" || item.status === "in_review"
      if (active === "Resolved") return item.status === "resolved"
    }
    return true
  })

  const renderRide = (ride) => (
    <div key={ride._id || Math.random()} className="flex flex-col sm:flex-row justify-between sm:items-center border border-gray-100 bg-gray-50/50 rounded-2xl p-5 hover:border-red-200 hover:bg-white hover:shadow-md transition-all cursor-pointer gap-4">
      <div>
        <p className="font-extrabold text-gray-900 text-[17px]">
          {ride.riderName || "Rider"} <span className="text-gray-400 font-medium px-1">→</span> {ride.passenger?.name || "No Passenger"}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[13px] text-gray-500 font-medium mt-1.5">
          <span className="font-semibold text-emerald-600 tracking-wide">₹{ride.fare?.amount || "0"}</span>
          <span className="hidden sm:inline text-gray-300">•</span>
          <span className="text-xs uppercase tracking-wider">{new Date(ride.createdAt).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}</span>
          <span className="hidden sm:inline text-gray-300">•</span>
          <span className="text-xs tracking-wider">{ride.pickupAddress ? ride.pickupAddress.split(',')[0] : "Location hidden"}</span>
        </div>
      </div>
      <div className="flex gap-2">
         <span className={`text-[11px] px-3 py-1.5 rounded-xl uppercase tracking-wider font-bold shadow-sm ${
           ['completed'].includes(ride.status) ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : 
           ['ongoing','pickup_started','locked'].includes(ride.status) ? "bg-blue-100 text-blue-800 border border-blue-200" : 
           ['cancelled'].includes(ride.status) ? "bg-red-50 text-red-600 border border-red-100" : "bg-orange-50 text-orange-700 border border-orange-200"
         }`}>
          {ride.status.replace("_", " ")}
         </span>
      </div>
    </div>
  )

  const renderComplaint = (comp) => (
    <div key={comp._id || Math.random()} className="flex flex-col border border-gray-100 bg-gray-50/50 rounded-2xl p-5 hover:border-red-200 hover:bg-white hover:shadow-md transition-all gap-3">
      <div className="flex justify-between items-start">
        <div>
           <p className="font-extrabold text-gray-900 text-[17px]">
             {comp.userId?.firstName} {comp.userId?.lastName} <span className="text-gray-400 font-medium px-1">reported</span> {comp.against || "an issue"}
           </p>
           <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[13px] text-gray-500 font-medium mt-1">
             <span className="font-semibold text-[#a10d18] tracking-wide">{comp.complaintType}</span>
             <span className="hidden sm:inline text-gray-300">•</span>
             <span className="text-xs uppercase tracking-wider">{new Date(comp.createdAt).toLocaleString()}</span>
           </div>
        </div>
        <div className="flex gap-2">
           <span className={`text-[11px] px-3 py-1.5 rounded-xl uppercase tracking-wider font-bold shadow-sm ${
             comp.status === 'resolved' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : 
             "bg-orange-50 text-orange-700 border border-orange-200"
           }`}>
            {comp.status?.replace("_", " ")}
           </span>
        </div>
      </div>
      <p className="text-sm text-gray-800 bg-white p-3 rounded-xl border border-gray-100">
        {comp.complaint}
      </p>
      {comp.attachment && (
        <div className="mt-1">
          <p className="text-xs text-gray-500 mb-1">Attachment:</p>
          <img src={comp.attachment} alt="Attachment" className="max-h-40 rounded-xl border border-gray-200 object-contain" />
        </div>
      )}

      {/* Admin response block */}
      {comp.adminResponse ? (
        <div className="bg-gray-100 rounded-xl p-3 border border-gray-200 mt-2">
           <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Support Response</p>
           <p className="text-sm font-medium text-gray-800">{comp.adminResponse}</p>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
           <textarea 
             placeholder="Type response for the user..."
             value={responseTexts[comp._id] || ""}
             onChange={e => setResponseTexts(prev => ({...prev, [comp._id]: e.target.value}))}
             className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a10d18]/20 focus:border-[#a10d18] transition resize-none"
             rows={2}
           />
           <div className="flex gap-2 justify-end">
              <button 
                onClick={() => submitResponse(comp._id, "in_review")}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition"
              >
                Respond (Keep Open)
              </button>
              <button 
                onClick={() => submitResponse(comp._id, "resolved")}
                className="px-4 py-2 bg-[#a10d18] text-white text-xs font-bold rounded-lg hover:bg-red-800 transition"
              >
                Respond & Close Ticket
              </button>
           </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-white rounded-[24px] p-6 lg:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <h3 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h3>
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setActive(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${active === f ? "bg-[#a10d18] text-white shadow-md shadow-red-900/20" : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      {filtered.length === 0 ? (
        <p className="text-[15px] text-gray-500 font-medium pt-2 pb-6 pl-2">{emptyMsg}</p>
      ) : (
        <div className="mt-8 space-y-3">
          {type === "rides" && filtered.map(renderRide)}
          {type === "reports" && filtered.map(renderComplaint)}
          {type !== "rides" && type !== "reports" && <p className="text-[15px] text-gray-500 font-medium pt-2 pb-6 pl-2">Display coming soon.</p>}
        </div>
      )}
    </div>
  )
}

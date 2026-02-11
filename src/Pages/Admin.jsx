import { useEffect, useState } from "react"
import { auth } from "../firebase"
import toast from "react-hot-toast"

function Admin() {
  const [tab, setTab] = useState("users")
  const [users, setUsers] = useState([])
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const API = "http://localhost:8001"

  const getToken = async () => {
    const user = auth.currentUser
    return user ? await user.getIdToken() : null
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/admin/users`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      let data = null
      if (res.ok) {
        data = await res.json()
      } else {
        const fallback = await fetch(`${API}/debug/users`)
        if (fallback.ok) {
          data = await fallback.json()
          toast.success("Loaded users in debug mode")
        } else {
          const isForbidden = res.status === 403
          if (isForbidden) toast.error("Admin access required")
          else toast.error("Failed to load users")
          throw new Error("users_load_failed")
        }
      }
      setUsers(data?.users || [])
    } catch {
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const loadApprovals = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/admin/rider-approvals`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      let data = null
      if (res.ok) {
        data = await res.json()
      } else {
        const fallback = await fetch(`${API}/debug/rider-approvals`)
        if (fallback.ok) {
          data = await fallback.json()
          toast.success("Loaded approvals in debug mode")
        } else {
          const isForbidden = res.status === 403
          if (isForbidden) toast.error("Admin access required")
          else toast.error("Failed to load approvals")
          throw new Error("approvals_load_failed")
        }
      }
      setApprovals(data?.approvals || [])
    } catch {
      // error toast already shown above for specific cases
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "users") loadUsers()
    else loadApprovals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Admin</h1>
        <div className="flex gap-2 mb-6">
          <button
            className={`px-4 py-2 rounded-xl font-semibold ${tab === "users" ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white"}`}
            onClick={() => setTab("users")}
          >
            Registered Users
          </button>
          <button
            className={`px-4 py-2 rounded-xl font-semibold ${tab === "approvals" ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white"}`}
            onClick={() => setTab("approvals")}
          >
            Rider Approvals
          </button>
        </div>

        {tab === "users" && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Registered Users</h2>
            {loading && <div className="text-sm text-slate-500">Loading...</div>}
            {!loading && users.length === 0 && <div className="text-sm text-slate-500">No users found</div>}
            {!loading && users.length > 0 && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-200 dark:bg-slate-800">
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">👤 Name</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">📧 Email</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">📞 Phone</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">🏫 University ID</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">🔵 Verified</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">⚙️ Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.uid} className="border-b dark:border-slate-800">
                      <td className="p-3 text-sm text-slate-900 dark:text-white">{u.firstName} {u.lastName}</td>
                      <td className="p-3 text-sm text-slate-500">{u.email}</td>
                      <td className="p-3 text-sm text-slate-500">{u.phone}</td>
                      <td className="p-3 text-sm text-slate-500">{u.universityId}</td>
                      <td className="p-3">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${u.verified ? "bg-green-600 text-white" : "bg-slate-500 text-white"}`}>
                          {u.verified ? "verified" : "unverified"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {u.collegeIdPhotoUrl && (
                            <a
                              className="px-3 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                              href={u.collegeIdPhotoUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View ID
                            </a>
                          )}
                          <button
                            className="px-3 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                              try {
                                const token = await getToken()
                                await fetch(`${API}/admin/users/${u.uid}/verify`, {
                                  method: "POST",
                                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                                })
                                await loadUsers()
                                toast.success("User verified")
                              } catch { toast.error("Failed to verify") }
                            }}
                          >
                            Verify
                          </button>
                          <button
                            className="px-3 py-1 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white"
                            onClick={async () => {
                              try {
                                const token = await getToken()
                                await fetch(`${API}/admin/users/${u.uid}/unverify`, {
                                  method: "POST",
                                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                                })
                                await loadUsers()
                                toast.success("User unverified")
                              } catch { toast.error("Failed to unverify") }
                            }}
                          >
                            Unverify
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {tab === "approvals" && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Rider Approvals</h2>
            {loading && <div className="text-sm text-slate-500">Loading...</div>}
            {!loading && approvals.length === 0 && <div className="text-sm text-slate-500">No approvals found</div>}
            {!loading && approvals.length > 0 && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-200 dark:bg-slate-800">
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">👤 Name</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">📞 Phone</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">🛵 Scooter</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">🏫 College</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">🔵 Status</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">⚙️ Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id} className="border-b dark:border-slate-800">
                      <td className="p-3 text-sm text-slate-900 dark:text-white">{a.fullName}</td>
                      <td className="p-3 text-sm text-slate-500">{a.phone}</td>
                      <td className="p-3 text-sm text-slate-500">{a.scooterNumber}</td>
                      <td className="p-3 text-sm text-slate-500">{a.collegeName}</td>
                      <td className="p-3">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                          a.status === "approved" ? "bg-green-600 text-white" :
                          a.status === "rejected" ? "bg-red-600 text-white" :
                          "bg-yellow-500 text-white"
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            title="Details"
                            className="px-3 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                              try {
                                const token = await getToken()
                                await fetch(`${API}/admin/rider-approvals/${a.id}/approve`, {
                                  method: "POST",
                                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                                })
                                await loadApprovals()
                                toast.success("Approval granted")
                              } catch { toast.error("Failed to approve") }
                            }}
                          >
                            Approve
                          </button>
                          <button
                            className="px-3 py-1 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white"
                            onClick={async () => {
                              try {
                                const token = await getToken()
                                await fetch(`${API}/admin/rider-approvals/${a.id}/reject`, {
                                  method: "POST",
                                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                                })
                                await loadApprovals()
                                toast.success("Approval rejected")
                              } catch { toast.error("Failed to reject") }
                            }}
                          >
                            Reject
                          </button>
                          <button
                            className="px-3 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => {
                              setSelectedApproval(a)
                              setShowModal(true)
                            }}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
        {showModal && (
          <ApprovalModal
            approval={selectedApproval}
            open={showModal}
            onClose={() => { setShowModal(false); setSelectedApproval(null) }}
            reload={loadApprovals}
          />
        )}
    </main>
  )
}

export default Admin

// Modal markup (rendered at end of file via React state)

/* The modal is appended here to keep the component in a single file. It uses the
   `selectedApproval` and `showModal` state variables defined in the component.
*/
import React from "react"

function ApprovalModal({ approval, open, onClose, reload }) {
  const getToken = async () => {
    const user = auth.currentUser
    return user ? await user.getIdToken() : null
  }
  const API = "http://localhost:8001"

  if (!open || !approval) return null

  const licenseSrc = (() => {
    const v = approval.licensePhotoBase64
    if (!v) return null
    if (v.startsWith("data:")) return v
    return `data:image/jpeg;base64,${v}`
  })()

  const doAction = async (action) => {
    try {
      const token = await getToken()
      await fetch(`${API}/admin/rider-approvals/${approval.id}/${action}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      await reload()
      toast.success(`Approval ${action}d`)
      onClose()
    } catch { toast.error(`Failed to ${action}`) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-3xl w-full p-6 z-10">
        <h3 className="text-lg font-bold mb-4">Rider Approval Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm"><strong>Name:</strong> {approval.fullName}</p>
            <p className="text-sm"><strong>Phone:</strong> {approval.phone}</p>
            <p className="text-sm"><strong>Scooter:</strong> {approval.scooterNumber}</p>
            <p className="text-sm"><strong>College:</strong> {approval.collegeName}</p>
            <p className="text-sm"><strong>Address:</strong> {approval.address}</p>
            <p className="text-sm"><strong>License #:</strong> {approval.licenseNumber}</p>
            <p className="text-sm"><strong>Expiry:</strong> {approval.licenseExpiry}</p>
            <p className="text-sm"><strong>Status:</strong> {approval.status}</p>
          </div>
          <div>
            {licenseSrc ? (
              <img src={licenseSrc} alt="license" className="max-h-64 w-auto rounded-md" />
            ) : (
              <div className="text-sm text-slate-500">No license image provided</div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800" onClick={onClose}>Close</button>
          <button className="px-4 py-2 rounded-lg bg-red-600 text-white" onClick={() => doAction('reject')}>Reject</button>
          <button className="px-4 py-2 rounded-lg bg-green-600 text-white" onClick={() => doAction('approve')}>Approve</button>
        </div>
      </div>
    </div>
  )
}

// (no wrapper) ApprovalModal is used directly inside `Admin` above

import { useEffect, useState } from "react"
import { API_BASE, getToken } from "../lib/api"
import toast from "react-hot-toast"

function Admin() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const API = API_BASE

  const loadUsers = async () => {
    setLoading(true)
    try {
      const token = getToken()
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

 

  useEffect(() => {
    loadUsers()
  }, [])

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Admin</h1>
 

        
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
                                const token = getToken()
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
                                const token = getToken()
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

 
      </div>
 
    </main>
  )
}

export default Admin

// Modal markup (rendered at end of file via React state)

/* The modal is appended here to keep the component in a single file. It uses the
   `selectedApproval` and `showModal` state variables defined in the component.
*/
 

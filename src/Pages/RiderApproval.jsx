import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth } from "../firebase"
import toast from "react-hot-toast"
import { signInWithEmailAndPassword } from "firebase/auth"

function RiderApproval() {
  const navigate = useNavigate()
  const [user, setUser] = useState(auth.currentUser)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    scooterNumber: "",
    collegeName: "",
    address: "",
    licenseNumber: "",
    licenseExpiry: "",
  })
  const [licenseFile, setLicenseFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error("Enter email and password")
      return
    }
    try {
      setLoggingIn(true)
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword)
      setUser(auth.currentUser)
      const API = "http://localhost:8001"
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
      if (token) {
        const resA = await fetch(`${API}/rider-approval/mine`, { headers: { Authorization: `Bearer ${token}` } })
        const dataA = await resA.json()
        const approved = !!(dataA?.approval && dataA.approval.status === "approved")
        const resU = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
        const dataU = await resU.json()
        const verified = !!dataU?.user?.verified
        if (approved && verified) {
          toast.success("Logged in — verified rider")
          navigate("/giveride")
        } else {
          toast.success("Logged in — complete rider approval")
        }
      } else {
        toast.success("Logged in successfully")
      }
      setLoginEmail("")
      setLoginPassword("")
    } catch (err) {
      toast.error(err.message || "Login failed")
    } finally {
      setLoggingIn(false)
    }
  }

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(",")[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!form.fullName.trim() || !form.phone.trim() || !form.scooterNumber.trim() || !form.collegeName.trim() || !form.address.trim() || !form.licenseNumber.trim() || !form.licenseExpiry.trim() || !licenseFile) {
      toast.error("Fill all fields and attach license photo")
      return
    }
    try {
      setSubmitting(true)
      const user = auth.currentUser
      const token = user ? await user.getIdToken() : null
      if (!token) {
        toast.error("Login required")
        setSubmitting(false)
        return
      }
      const base64 = await toBase64(licenseFile)
      const payload = { ...form, licensePhotoBase64: base64 }
      const t = toast.loading("Submitting...")
      const API = "http://localhost:8001"
      await fetch(`${API}/rider-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      toast.success("Submitted for approval", { id: t })
      setSubmitting(false)
      // stay on this page or redirect to dashboard; do not allow direct access to GiveRide until admin approves
      navigate("/dashboard")
    } catch {
      toast.error("Submission failed")
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border p-6">
        {!user ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Rider Login</h1>
            <form className="space-y-4" onSubmit={handleLogin}>
              <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
              <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              <button className={`w-full py-2 rounded-xl font-semibold ${loggingIn ? "bg-slate-400 text-slate-800" : "bg-blue-600 hover:bg-blue-700 text-white"}`} disabled={loggingIn} type="submit">
                {loggingIn ? "Logging in..." : "Login"}
              </button>
            </form>
            <div className="mt-4 text-sm text-slate-500 text-center">
              Don't have an account? <a href="/register" className="text-blue-600 underline">Register here</a>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Rider Approval</h1>
            <form className="space-y-4" onSubmit={onSubmit}>
          <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" name="fullName" placeholder="Full Name" value={form.fullName} onChange={onChange} />
          <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" name="phone" placeholder="Phone" value={form.phone} onChange={onChange} />
          <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" name="scooterNumber" placeholder="Scooter / Bike Number" value={form.scooterNumber} onChange={onChange} />
          <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" name="collegeName" placeholder="College Name" value={form.collegeName} onChange={onChange} />
          <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" name="address" placeholder="Address" value={form.address} onChange={onChange} />
          <div className="grid grid-cols-2 gap-3">
            <input className="rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" name="licenseNumber" placeholder="License Number" value={form.licenseNumber} onChange={onChange} />
            <input className="rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" type="date" name="licenseExpiry" placeholder="License Expiry" value={form.licenseExpiry} onChange={onChange} />
          </div>
          <input className="w-full rounded-xl px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" type="file" accept="image/*" onChange={(e) => setLicenseFile(e.target.files?.[0] || null)} />
          <button className={`w-full py-2 rounded-xl font-semibold ${submitting ? "bg-slate-400 text-slate-800" : "bg-blue-600 hover:bg-blue-700 text-white"}`} disabled={submitting} type="submit">
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </form>
          </>
        )}
      </div>
    </main>
  )
}

export default RiderApproval

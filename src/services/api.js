export const API_BASE = import.meta.env?.VITE_API_BASE || "/api"
export const getToken = () => localStorage.getItem("token") || null
export const setToken = (t) => localStorage.setItem("token", t)
export const clearToken = () => localStorage.removeItem("token")

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const token = getToken()
    console.log("🔑 Token:", token)        // ← Add this
  console.log("🌐 Fetching:", url)       // ← Add this
  
  const headers = new Headers(options.headers || {})
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  const res = await fetch(url, { ...options, headers })
  const ct = res.headers.get("content-type") || ""
  let data = null
  if (ct.includes("application/json")) {
    data = await res.json()
  } else {
    const text = await res.text()
    data = text ? { detail: text } : null
  }
  if (!res.ok) {
    if (res.status === 401) {
      console.warn("🔐 Session expired or invalid — clearing token and redirecting to login")
      clearToken()
      // Only redirect if we're not already on the login or landing page
      const currentPath = window.location.pathname
      if (currentPath !== "/login" && currentPath !== "/") {
        window.location.replace("/login")
      }
    }
    const msg = (data && (data.detail || data.message || data.error?.message)) || res.statusText || "Request failed"
    throw new Error(msg)
  }
  return data
}

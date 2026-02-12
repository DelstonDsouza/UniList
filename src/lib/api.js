export const API_BASE = import.meta.env?.VITE_API_BASE || "/api"
export const getToken = () => localStorage.getItem("token") || null
export const setToken = (t) => localStorage.setItem("token", t)
export const clearToken = () => localStorage.removeItem("token")

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, options)
  const ct = res.headers.get("content-type") || ""
  let data = null
  if (ct.includes("application/json")) {
    data = await res.json()
  } else {
    const text = await res.text()
    data = text ? { detail: text } : null
  }
  if (!res.ok) {
    const msg = (data && data.detail) || res.statusText || "Request failed"
    throw new Error(msg)
  }
  return data
}

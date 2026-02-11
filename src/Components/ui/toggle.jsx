import { useEffect, useState } from "react"
import "../ui/toggle.css"

function ThemeSwitch() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") === "dark")

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)

    if (next) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  return (
    <label className="switch">
      <span className="sun">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <g fill="#ffd43b">
            <circle cx="12" cy="12" r="5" />
          </g>
        </svg>
      </span>

      <span className="moon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
          <path d="m223.5 32c-123.5 0-223.5 100.3-223.5 224s100 224 223.5 224" />
        </svg>
      </span>

      <input
        type="checkbox"
        className="input"
        checked={isDark}
        onChange={toggleTheme}
      />
      <span className="slider" />
    </label>
  )
}

export default ThemeSwitch

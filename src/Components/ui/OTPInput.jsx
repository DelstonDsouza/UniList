// src/components/ui/OTPInput.jsx
import { useRef, useState, useCallback } from "react"

const OTPInput = ({ length = 4, onChange, disabled = false, error = false }) => {
  const [values, setValues] = useState(Array(length).fill(""))
  const inputsRef = useRef([])

  const focus = (i) => inputsRef.current[i]?.focus()

  const handleChange = useCallback((e, idx) => {
    const val = e.target.value.replace(/\D/g, "").slice(-1)
    setValues((prev) => {
      const next = [...prev]
      next[idx] = val
      onChange(next.join(""))
      return next
    })
    if (val && idx < length - 1) focus(idx + 1)
  }, [length, onChange])

  const handleKeyDown = useCallback((e, idx) => {
    if (e.key === "Backspace") {
      if (values[idx]) {
        setValues((prev) => {
          const next = [...prev]
          next[idx] = ""
          onChange(next.join(""))
          return next
        })
      } else if (idx > 0) {
        focus(idx - 1)
      }
    }
  }, [values, onChange])

  const handlePaste = useCallback((e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    const next = Array(length).fill("")
    pasted.split("").forEach((ch, i) => { next[i] = ch })
    setValues(next)
    onChange(next.join(""))
    focus(Math.min(pasted.length, length - 1))
  }, [length, onChange])

  return (
    <div className="flex gap-3 justify-center">
      {values.map((val, idx) => (
        <input
          key={idx}
          ref={(el) => (inputsRef.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          disabled={disabled}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          onPaste={handlePaste}
          className="w-14 h-14 text-center text-2xl font-bold rounded-xl outline-none transition-all duration-200 border-2"
          style={{
            background:  error ? "#FEF2F2" : "#F8FAFF",
            borderColor: error ? "#EF4444" : val ? "#2563EB" : "#E2E8F0",
            color:       "#1E293B",
            caretColor:  "#2563EB",
            boxShadow:   val && !error ? "0 0 0 3px #2563EB22" : "none",
          }}
        />
      ))}
    </div>
  )
}

export default OTPInput

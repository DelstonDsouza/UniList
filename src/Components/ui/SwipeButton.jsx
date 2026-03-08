// src/components/ui/SwipeButton.jsx
import { useState, useRef, useCallback } from "react"

const THRESHOLD = 0.85

const SwipeButton = ({ label, onSwipeComplete, color = "#16a34a", disabled = false }) => {
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const trackRef = useRef(null)
  const startXRef = useRef(null)

  const thumbSize = 56
  const maxTravel = () => (trackRef.current?.offsetWidth ?? 300) - thumbSize - 8

  const calcProgress = useCallback((clientX) =>
    Math.min(Math.max((clientX - startXRef.current) / maxTravel(), 0), 1), [])

  const onPointerDown = (e) => {
    if (disabled || completed) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startXRef.current = e.clientX
    setDragging(true)
  }

  const onPointerMove = (e) => {
    if (!dragging || startXRef.current === null) return
    setProgress(calcProgress(e.clientX))
  }

  const onPointerUp = (e) => {
    if (!dragging) return
    setDragging(false)
    const p = calcProgress(e.clientX)
    if (p >= THRESHOLD) {
      setProgress(1)
      setCompleted(true)
      setTimeout(() => onSwipeComplete(), 300)
    } else {
      setProgress(0)
    }
  }

  const thumbX = progress * maxTravel()

  return (
    <div
      ref={trackRef}
      className="relative select-none overflow-hidden rounded-2xl"
      style={{
        height: 64,
        width: "100%",
        background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        border: `1.5px solid ${color}44`,
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: color,
          width: `${8 + thumbSize + thumbX}px`,
          opacity: 0.15 + progress * 0.15,
        }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-semibold tracking-wide pointer-events-none"
        style={{ color, opacity: Math.max(1 - progress * 2, 0) }}
      >
        {completed ? "Done!" : label}
      </span>
      <div
        className="absolute top-1 flex items-center justify-center rounded-xl shadow-lg cursor-grab active:cursor-grabbing touch-none"
        style={{
          left: 4 + thumbX,
          width: thumbSize,
          height: thumbSize,
          background: color,
          transition: dragging ? "none" : "left 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

export default SwipeButton


import { useEffect, useRef } from "react"

function CanvasParticles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    let width, height, centerX, centerY
    const resize = () => {
      width = canvas.offsetWidth
      height = canvas.offsetHeight
      centerX = width / 2
      centerY = height / 2
      canvas.width = width
      canvas.height = height
    }
    resize()
    window.addEventListener("resize", resize)

    // ΓÜÖ∩╕Å CONFIG
    const PARTICLE_COUNT = window.innerWidth < 768 ? 50 : 120
    const CENTER_FORCE = 0.0025       // pulls toward center
    const ATTRACTION_RADIUS = 180
    const ATTRACTION_FORCE = 0.14
    const FRICTION = 0.96
    const MAX_SPEED = 2

    const mouse = {
      x: centerX,
      y: centerY,
      active: false,
    }

    // ≡ƒƒó Create particles around center
    const particles = Array.from({ length: PARTICLE_COUNT }).map(() => {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 120 // spread from center
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        size: Math.random() * 2 + 1,
      }
    })

    // ≡ƒÄ» Mouse tracking (window)
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.active = true
    }

    const handleMouseLeave = () => {
      mouse.active = false
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseleave", handleMouseLeave)

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      particles.forEach((p) => {
        /* ≡ƒÄ» CENTER GRAVITY */
        const cx = centerX - p.x
        const cy = centerY - p.y
        p.vx += cx * CENTER_FORCE
        p.vy += cy * CENTER_FORCE

        /* ≡ƒîè NATURAL ROAMING */
        p.vx += (Math.random() - 0.5) * 0.03
        p.vy += (Math.random() - 0.5) * 0.03

        /* ≡ƒº▓ CURSOR ATTRACTION */
        if (mouse.active) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < ATTRACTION_RADIUS && dist > 1) {
            const force = (1 - dist / ATTRACTION_RADIUS) * ATTRACTION_FORCE
            p.vx += (dx / dist) * force
            p.vy += (dy / dist) * force
          }
        }

        /* ≡ƒ¢æ FRICTION */
        p.vx *= FRICTION
        p.vy *= FRICTION

        /* ≡ƒÜÇ SPEED LIMIT */
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED
          p.vy = (p.vy / speed) * MAX_SPEED
        }

        /* Γ₧í∩╕Å MOVE */
        p.x += p.vx
        p.y += p.vy

        /* ≡ƒÄ¿ DRAW */
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(37, 99, 235, 0.8)" // KozhiGo blue
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
    />
  )
}

export default CanvasParticles

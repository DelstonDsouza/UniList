import { useEffect, useRef } from "react"
import styled from "styled-components"

function ThreeDFeatureCard({ icon, title, description, step }) {
  const cardRef = useRef(null)

  // 🎯 Cursor-based tilt
  const handleMouseMove = (e) => {
    const card = cardRef.current
    const rect = card.getBoundingClientRect()

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const rotateX = ((y - centerY) / centerY) * -10
    const rotateY = ((x - centerX) / centerX) * 10

    card.style.transform = `
      perspective(800px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(1.05)
    `
  }

  const resetTilt = () => {
    cardRef.current.style.transform =
      "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)"
  }

  // 👀 Scroll-in animation
  useEffect(() => {
    const card = cardRef.current

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          card.classList.add("visible")
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  return (
    <StyledWrapper>
      <figure
        ref={cardRef}
        className="card"
        onMouseMove={handleMouseMove}
        onMouseLeave={resetTilt}
      >
        {/* Step Number */}
        <span className="step">{step}</span>

        <div className="icon">{icon}</div>
        <figcaption className="title">{title}</figcaption>
        <p className="desc">{description}</p>
      </figure>
    </StyledWrapper>
  )
}
const StyledWrapper = styled.div`
  .card {
    width: 260px;
    height: 300px;
    background: linear-gradient(135deg, #0f172a, #020617);
    border: 1px solid #1e293b;
    border-radius: 18px;
    padding: 26px;
    text-align: center;
    transform-style: preserve-3d;
    transition: transform 0.15s ease, opacity 0.6s ease, translate 0.6s ease;
    opacity: 0;
    translate: 0 40px;
  }

  .card.visible {
    opacity: 1;
    translate: 0 0;
  }

  .step {
    position: absolute;
    top: 14px;
    right: 16px;
    font-size: 2.5rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }

  .icon {
    font-size: 2.8rem;
    margin-bottom: 18px;
    transform: translateZ(40px);
    color: #ffffff; 
  }

  .title {
    font-size: 1.2rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 10px;
    transform: translateZ(45px);
  }

  .desc {
    font-size: 0.9rem;
    color: #cbd5f5;
    line-height: 1.5;
    transform: translateZ(30px);
  }
`




export default ThreeDFeatureCard

import styled from "styled-components"

function FeatureCard({ icon, title, description }) {
  return (
    <StyledWrapper>
      <div className="card">
        <div className="background" />

        <div className="content">
          <div className="icon">{icon}</div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
    </StyledWrapper>
  )
}

const StyledWrapper = styled.div`
  .card {
    position: relative;
    height: 220px;
    border-radius: 24px;
    overflow: hidden;
    background: #f8fafc; /* slate-50 */
    box-shadow: rgba(15, 23, 42, 0.12) 0px 8px 28px;
    transition: transform 0.5s ease;
  }

  /* Hover Gradient (KozhiGo theme) */
  .background {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(
      135deg,
      #2563eb 0%,   /* blue-600 */
      #1e40af 45%,  /* blue-800 */
      #0f766e 100%  /* teal-700 (eco hint) */
    );
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  .content {
    position: relative;
    z-index: 2;
    height: 100%;
    padding: 28px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    color: #0f172a; /* slate-900 */
    transition: color 0.5s ease;
  }

  .icon {
    font-size: 2.6rem;
    margin-bottom: 14px;
  }

  h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 6px;
  }

  p {
    font-size: 0.9rem;
    color: #475569; /* slate-600 */
  }

  .card:hover {
    transform: scale(1.05);
  }

  .card:hover .background {
    opacity: 1;
  }

  .card:hover .content {
    color: #ffffff;
  }

  .card:hover p {
    color: #e2e8f0; /* slate-200 */
  }
`

export default FeatureCard

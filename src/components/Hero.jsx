export default function Hero() {
  return (
    <div className="hero">
      <div className="stars" aria-hidden="true"></div>

      <svg className="orbit" viewBox="0 0 1300 460" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="arcG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="#c9d0da" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#E3A93B" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#c9d0da" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path className="arc" d="M -50 420 A 1100 420 0 0 1 1350 420" stroke="url(#arcG)" strokeWidth="1.5" />
      </svg>

      <div className="scene" aria-hidden="true"></div>

      <div className="wrap">
        <h1 className="chrome">ZYNOVEX</h1>
        <p className="eyebrow">
          DISCOVER <i>·</i> REGISTER <i>·</i> VOLUNTEER
        </p>
        <div className="rule" aria-hidden="true"></div>
        <p className="herotag">
          The future of Bengaluru events starts <span>here</span>.
        </p>
        <a className="cta" href="#discover">
          EXPLORE EVENTS
        </a>
      </div>

      <a className="cue" href="#discover">
        SCROLL TO EXPLORE
      </a>
    </div>
  )
}

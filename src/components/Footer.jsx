export default function Footer({ onOpenAdminModal }) {
  return (
    <footer id="admin">
      <div className="wrap">
        <span className="chrome" style={{ font: '400 15px var(--display)', letterSpacing: '0.25em' }}>
          ZYNOVEX
        </span>
        <span>
          Every organizer is verified and every event is approved by our team before it goes live.
        </span>
        <span>Bengaluru, India</span>
        <span className="contact">
          <a href="mailto:zynovexx@gmail.com">zynovexx@gmail.com</a>
          {' · '}
          <a href="https://www.instagram.com/_zynovexx" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          {' · '}
          <a href="https://www.linkedin.com/company/zynovexx/" target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
        </span>
        <button
          className="olink"
          id="adminBtn"
          type="button"
          onClick={onOpenAdminModal}
        >
          Admin
        </button>
      </div>
    </footer>
  )
}

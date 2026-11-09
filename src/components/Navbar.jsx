import { useState } from 'react'

export default function Navbar({ onOpenOrgModal }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLinkClick = () => {
    setMenuOpen(false)
  }

  return (
    <header>
      <div className="wrap nav">
        <a className="logo chrome" href="#top" aria-label="ZYNOVEX home">
          ZYNOVEX
        </a>

        <button
          className="menu"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav className={'links' + (menuOpen ? ' open' : '')} aria-label="Main" onClick={handleLinkClick}>
          <a href="#discover">Discover events</a>
          <a href="#volunteer">Volunteer</a>
          <a href="#organizers">For organizers</a>
          <a href="#admin">Verified organizers</a>
        </nav>

        <button
          className="btn solid"
          type="button"
          onClick={onOpenOrgModal}
        >
          Manage events
        </button>
      </div>
    </header>
  )
}

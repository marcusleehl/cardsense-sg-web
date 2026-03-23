import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <header
      className="sticky top-0 z-40 w-full bg-white"
      style={{ borderBottom: '1px solid #E5E7EB' }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-1.5 font-bold text-lg tracking-tight no-underline"
          style={{ color: '#1F4E79' }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect width="22" height="22" rx="5" fill="#1F4E79" />
            <rect x="3" y="7" width="16" height="2.5" rx="1.25" fill="white" />
            <rect x="3" y="12" width="6" height="2.5" rx="1.25" fill="white" opacity="0.7" />
          </svg>
          CardSense SG
        </Link>

        {/* Future nav links placeholder */}
        <nav className="flex items-center gap-6" aria-label="Main navigation">
          {/* Reserved for future links */}
        </nav>
      </div>
    </header>
  )
}

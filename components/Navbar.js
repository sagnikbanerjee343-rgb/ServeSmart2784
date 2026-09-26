import Link from 'next/link'
import { useRouter } from 'next/router'
import { logout } from '../lib/auth'

const ROLE_LINKS = {
  student: [
    { href: '/tickets', label: 'My Tickets' },
    { href: '/tickets/new', label: 'New Ticket' },
  ],
  technician: [{ href: '/technician/dashboard', label: 'My Queue' }],
  admin: [
    { href: '/admin/dashboard', label: 'Analytics' },
    { href: '/admin/assign', label: 'Assignment' },
  ],
}

export default function Navbar({ user, title }) {
  const router = useRouter()
  const links = ROLE_LINKS[user.role] || []

  function handleLogout() {
    logout()
    router.push('/')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/" className="wordmark">
          ServeSmart
        </Link>
      </div>
      <nav className="topbar-links">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={router.pathname === link.href ? 'active' : ''}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="topbar-user">
        <span className="role-chip">{user.role}</span>
        <span className="topbar-name">{user.name}</span>
        <button className="btn btn-ghost" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  )
}

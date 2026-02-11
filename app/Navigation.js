'use client'
import { usePathname, useRouter } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

  // Don't show navigation on login page
  if (pathname === '/login') {
    return null
  }

  const handleLogout = async () => {
    localStorage.removeItem('gazette-auth')
    router.push('/login')
  }

  const isActive = (path) => {
    if (path === '/feed') return pathname === '/' || pathname === '/feed'
    return pathname.startsWith(path)
  }

  const navStyle = {
    backgroundColor: '#000',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    padding: '0',
    position: 'sticky',
    top: 0,
    zIndex: 1000
  }

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }

  const leftStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '32px'
  }

  const brandStyle = {
    fontSize: '13px',
    fontWeight: '500',
    letterSpacing: '3px',
    color: '#fff',
    textTransform: 'uppercase',
    margin: 0
  }

  const tabsStyle = {
    display: 'flex',
    gap: '8px'
  }

  const getTabStyle = (active) => ({
    padding: '8px 16px',
    backgroundColor: active ? '#fff' : 'transparent',
    color: active ? '#000' : '#F4F4F4',
    border: `1px solid ${active ? '#fff' : '#F4F4F4'}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    display: 'inline-block'
  })

  const logoutStyle = {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#F4F4F4',
    border: '1px solid #F4F4F4',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    transition: 'all 0.2s ease'
  }

  return (
    <nav style={navStyle}>
      <div style={containerStyle}>
        <div style={leftStyle}>
          <h1 style={brandStyle}>Administration List</h1>
          <div style={tabsStyle}>
            <a
              href="/feed"
              style={getTabStyle(isActive('/feed'))}
              onMouseOver={(e) => !isActive('/feed') && (e.target.style.backgroundColor = 'rgba(255,255,255,0.1)')}
              onMouseOut={(e) => !isActive('/feed') && (e.target.style.backgroundColor = 'transparent')}
            >
              Feed
            </a>
            <a
              href="/dashboard"
              style={getTabStyle(isActive('/dashboard'))}
              onMouseOver={(e) => !isActive('/dashboard') && (e.target.style.backgroundColor = 'rgba(255,255,255,0.1)')}
              onMouseOut={(e) => !isActive('/dashboard') && (e.target.style.backgroundColor = 'transparent')}
            >
              Dashboard
            </a>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={logoutStyle}
          onMouseOver={(e) => { e.target.style.backgroundColor = '#fff'; e.target.style.color = '#000' }}
          onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#F4F4F4' }}
        >
          Logout
        </button>
      </div>
    </nav>
  )
}

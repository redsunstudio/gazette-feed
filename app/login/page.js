'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password === 'AdminList123!') {
      localStorage.setItem('gazette-auth', 'true')
      router.push('/')
    } else {
      setError('Invalid password')
      setPassword('')
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '24px'
      }}>
        <div style={{
          backgroundColor: '#262626',
          borderRadius: '8px',
          padding: '48px 32px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            <h1 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: '500',
              letterSpacing: '3px',
              color: '#fff',
              textTransform: 'uppercase'
            }}>
              GAZETTE FEED
            </h1>
            <p style={{
              margin: '10px 0 0',
              color: '#F4F4F4',
              fontSize: '14px'
            }}>
              Intelligence Dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#F4F4F4',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: '500'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                fontSize: '14px',
                marginBottom: '24px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.5)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.2)'
              }}
            />

            {error && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(220,38,38,0.1)',
                border: '1px solid #dc2626',
                color: '#fca5a5',
                borderRadius: '4px',
                fontSize: '12px',
                marginBottom: '20px'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={(e) => {
                if (!loading) e.target.style.opacity = '0.9'
              }}
              onMouseOut={(e) => {
                if (!loading) e.target.style.opacity = '1'
              }}
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>

          <p style={{
            margin: 0,
            fontSize: '12px',
            color: '#F4F4F4',
            opacity: 0.6,
            textAlign: 'center'
          }}>
            Secure access • Companies House data
          </p>
        </div>
      </div>
    </div>
  )
}

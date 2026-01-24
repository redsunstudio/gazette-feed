'use client'
import { useState, useEffect } from 'react'

export default function Home() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetched, setLastFetched] = useState(null)

  const fetchNotices = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/notices')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setNotices(data.notices)
      setLastFetched(new Date().toLocaleTimeString())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotices()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchNotices, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getTypeColor = (code) => {
    if (!code) return '#666'
    const c = String(code)
    if (c.startsWith('245')) return '#dc2626' // Winding up petitions - red
    if (c.startsWith('244')) return '#ea580c' // CVL - orange
    if (c.startsWith('243')) return '#d97706' // Winding up / liquidation - amber
    if (c.startsWith('241')) return '#7c3aed' // Administration - purple
    if (c.startsWith('250')) return '#0891b2' // Personal insolvency - cyan
    return '#666'
  }

  return (
    <div>
      <header style={{ marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Gazette Insolvency Feed</h1>
        <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>
          Monitoring liquidations, winding up petitions, and insolvencies
          {lastFetched && <span> · Last updated: {lastFetched}</span>}
        </p>
      </header>

      <button
        onClick={fetchNotices}
        disabled={loading}
        style={{
          marginBottom: '20px',
          padding: '8px 16px',
          backgroundColor: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'wait' : 'pointer'
        }}
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '4px', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      <div>
        {notices.length === 0 && !loading && (
          <p style={{ color: '#666' }}>No notices found.</p>
        )}

        {notices.map((notice, i) => (
          <article
            key={notice.id || i}
            style={{
              backgroundColor: 'white',
              padding: '15px',
              marginBottom: '10px',
              borderRadius: '6px',
              borderLeft: `4px solid ${getTypeColor(notice.noticeCode)}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <div>
                <span style={{
                  fontSize: '11px',
                  backgroundColor: getTypeColor(notice.noticeCode),
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  marginRight: '8px'
                }}>
                  {notice.noticeType || notice.category || 'Notice'}
                </span>
                <span style={{ fontSize: '12px', color: '#666' }}>
                  {notice.published ? new Date(notice.published).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  }) : ''}
                </span>
              </div>
            </div>

            <h3 style={{ margin: '10px 0 0', fontSize: '16px' }}>
              <a href={notice.link} target="_blank" rel="noopener noreferrer" style={{ color: '#1a1a1a', textDecoration: 'none' }}>
                {notice.title || 'Untitled Notice'}
              </a>
            </h3>
          </article>
        ))}
      </div>
    </div>
  )
}

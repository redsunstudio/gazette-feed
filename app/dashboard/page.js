'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Date range state
  const [startDate, setStartDate] = useState('2020-01-01')
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  // Check authentication
  useEffect(() => {
    const auth = localStorage.getItem('gazette-auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
      setAuthChecked(true)
    } else {
      router.push('/login')
    }
  }, [router])

  // Fetch data
  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated, startDate, endDate])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics?start_date=${startDate}&end_date=${endDate}`)
      const result = await res.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function setPreset(days) {
    const today = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }

  if (!authChecked || !isAuthenticated) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '80vh',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '3px', color: '#fff' }}>
            Analytics Dashboard
          </div>
          <div style={{ fontSize: '11px', fontWeight: '400', color: '#F4F4F4', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4px' }}>
            Subscription & Traffic Data
          </div>
        </div>

        {/* Date Picker */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                background: 'transparent',
                border: '1px solid #F4F4F4',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '4px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                letterSpacing: '0.5px',
                colorScheme: 'dark'
              }}
            />
            <span style={{ color: '#F4F4F4', fontSize: '14px' }}>→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                background: 'transparent',
                border: '1px solid #F4F4F4',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '4px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                letterSpacing: '0.5px',
                colorScheme: 'dark'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'Last 7 days', days: 7 },
              { label: 'Last 30 days', days: 30 },
              { label: 'Last 90 days', days: 90 },
              { label: 'This year', days: 365 }
            ].map(preset => (
              <button
                key={preset.days}
                onClick={() => setPreset(preset.days)}
                style={{
                  background: 'transparent',
                  border: '1px solid #F4F4F4',
                  color: '#F4F4F4',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '10px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => { e.target.style.background = '#fff'; e.target.style.color = '#000' }}
                onMouseOut={(e) => { e.target.style.background = 'transparent'; e.target.style.color = '#F4F4F4' }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading/Error States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#F4F4F4' }}>
            Loading analytics data...
          </div>
        )}

        {error && (
          <div style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(220,38,38,0.1)',
            border: '1px solid #dc2626',
            color: '#fca5a5',
            borderRadius: '4px',
            marginBottom: '24px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* KPI Cards */}
        {data && data.kpis && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: data.show_revenue ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '40px'
            }}>
              <div style={{ background: '#262626', borderRadius: '8px', padding: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#F4F4F4', marginBottom: '12px' }}>
                  Monthly Subs
                </div>
                <div style={{ fontSize: '36px', fontWeight: '600', color: '#fff', lineHeight: '1' }}>
                  {data.kpis.monthly}
                </div>
              </div>

              <div style={{ background: '#262626', borderRadius: '8px', padding: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#F4F4F4', marginBottom: '12px' }}>
                  Annual Subs
                </div>
                <div style={{ fontSize: '36px', fontWeight: '600', color: '#fff', lineHeight: '1' }}>
                  {data.kpis.annual}
                </div>
              </div>

              <div style={{ background: '#262626', borderRadius: '8px', padding: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#F4F4F4', marginBottom: '12px' }}>
                  Purchases
                </div>
                <div style={{ fontSize: '36px', fontWeight: '600', color: '#fff', lineHeight: '1' }}>
                  {data.kpis.purchases}
                </div>
              </div>

              {data.show_revenue && (
                <div style={{ background: '#262626', borderRadius: '8px', padding: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#F4F4F4', marginBottom: '12px' }}>
                    Revenue
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: '600', color: '#fff', lineHeight: '1' }}>
                    £{Math.round(data.kpis.revenue).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Trend Data */}
            {data.trend && data.trend.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  color: '#F4F4F4',
                  marginBottom: '16px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #262626'
                }}>
                  Subscriptions by Month
                </div>
                <div style={{ background: '#262626', borderRadius: '8px', padding: '24px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>Month</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>Monthly</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>Annual</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>Purchases</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trend.map(row => (
                        <tr key={row.yearMonth}>
                          <td style={{ padding: '8px', color: '#fff' }}>{row.label}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>{row.monthly}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>{row.annual}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>{row.purchase}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#fff', fontWeight: '600' }}>
                            {row.monthly + row.annual + row.purchase}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Traffic Channels */}
            {data.channels && data.channels.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  color: '#F4F4F4',
                  marginBottom: '16px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #262626'
                }}>
                  Traffic by Channel
                </div>
                <div style={{ background: '#262626', borderRadius: '8px', padding: '24px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>Channel</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>Sessions</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>Users</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>New Users</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: '#F4F4F4', fontWeight: '500' }}>% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.channels.map(channel => (
                        <tr key={channel.channel}>
                          <td style={{ padding: '8px', color: '#fff' }}>{channel.channel}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>{channel.sessions.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>{channel.users.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#fff' }}>{channel.newUsers.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#fff', fontWeight: '600' }}>{channel.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

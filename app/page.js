'use client'
import { useState, useEffect } from 'react'

const FILTERS = [
  { id: 'all', label: 'All', prefixes: null },
  { id: 'petitions', label: 'Winding Up Petitions', prefixes: ['245'], color: '#dc2626' },
  { id: 'liquidations', label: 'Liquidations', prefixes: ['243', '244'], color: '#ea580c' },
  { id: 'administrations', label: 'Administrations', prefixes: ['241'], color: '#7c3aed' },
]

export default function Home() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cacheInfo, setCacheInfo] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  // Analysis state
  const [analyzing, setAnalyzing] = useState(null) // notice id being analyzed
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const fetchNotices = async (forceRefresh = false) => {
    try {
      setLoading(true)
      const url = forceRefresh ? '/api/notices?refresh=true' : '/api/notices'
      const res = await fetch(url)
      const data = await res.json()
      if (data.error && !data.notices?.length) throw new Error(data.error)
      setNotices(data.notices || [])
      setCacheInfo({
        cached: data.cached,
        fetched: data.fetched,
        cacheAge: data.cacheAge,
        nextRefresh: data.nextRefresh,
        stale: data.stale
      })
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const analyzeCompany = async (notice) => {
    setAnalyzing(notice.id)
    setAnalysisError(null)
    setAnalysisResult(null)
    setShowModal(true)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: notice.title,
          noticeType: notice.noticeType,
          noticeDate: notice.published
        })
      })

      const data = await res.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setAnalysisResult(data)
    } catch (err) {
      setAnalysisError(err.message)
    } finally {
      setAnalyzing(null)
    }
  }

  const downloadPDF = async () => {
    if (!analysisResult) return

    // Dynamically import jspdf to avoid SSR issues
    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - margin * 2

    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Company Analysis Report', margin, 25)

    // Company name
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text(analysisResult.companyName || 'Unknown Company', margin, 35)

    // Date
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date(analysisResult.generatedAt).toLocaleString()}`, margin, 42)

    // Analysis content
    doc.setTextColor(0)
    doc.setFontSize(11)

    const lines = doc.splitTextToSize(analysisResult.analysis, maxWidth)
    let y = 55
    const lineHeight = 5
    const pageHeight = doc.internal.pageSize.getHeight()

    for (const line of lines) {
      if (y > pageHeight - 20) {
        doc.addPage()
        y = 20
      }

      // Check for headers (lines starting with **)
      if (line.includes('**')) {
        doc.setFont('helvetica', 'bold')
        doc.text(line.replace(/\*\*/g, ''), margin, y)
        doc.setFont('helvetica', 'normal')
      } else {
        doc.text(line, margin, y)
      }
      y += lineHeight
    }

    // Save
    const fileName = `${analysisResult.companyName?.replace(/[^a-zA-Z0-9]/g, '_') || 'analysis'}_report.pdf`
    doc.save(fileName)
  }

  const closeModal = () => {
    setShowModal(false)
    setAnalysisResult(null)
    setAnalysisError(null)
  }

  useEffect(() => {
    fetchNotices()
    // Auto-refresh every 30 minutes (matches server cache TTL)
    const interval = setInterval(() => fetchNotices(), 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getTypeColor = (code) => {
    if (!code) return '#666'
    const c = String(code)
    if (c.startsWith('245')) return '#dc2626'
    if (c.startsWith('244')) return '#ea580c'
    if (c.startsWith('243')) return '#d97706'
    if (c.startsWith('241')) return '#7c3aed'
    if (c.startsWith('250')) return '#0891b2'
    return '#666'
  }

  const filteredNotices = notices.filter(notice => {
    if (activeFilter === 'all') return true
    const filter = FILTERS.find(f => f.id === activeFilter)
    if (!filter || !filter.prefixes) return true
    const code = String(notice.noticeCode || '')
    return filter.prefixes.some(prefix => code.startsWith(prefix))
  })

  const getCounts = () => {
    const counts = { all: notices.length }
    FILTERS.forEach(filter => {
      if (filter.prefixes) {
        counts[filter.id] = notices.filter(n => {
          const code = String(n.noticeCode || '')
          return filter.prefixes.some(prefix => code.startsWith(prefix))
        }).length
      }
    })
    return counts
  }

  const counts = getCounts()

  return (
    <div>
      <header style={{ marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Gazette Insolvency Feed</h1>
        <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>
          Monitoring liquidations, winding up petitions, and administrations
          {cacheInfo && (
            <span>
              {' · '}
              {cacheInfo.cached ? (
                <>Cached {Math.round(cacheInfo.cacheAge / 60)}m ago</>
              ) : (
                <>Fresh data</>
              )}
              {cacheInfo.stale && <span style={{ color: '#ea580c' }}> (stale)</span>}
            </span>
          )}
        </p>
      </header>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map(filter => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            style={{
              padding: '6px 12px',
              backgroundColor: activeFilter === filter.id ? (filter.color || '#333') : 'transparent',
              color: activeFilter === filter.id ? 'white' : '#666',
              border: `1px solid ${filter.color || '#333'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s ease'
            }}
          >
            {filter.label} ({counts[filter.id] || 0})
          </button>
        ))}

        <button
          onClick={() => fetchNotices(true)}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '13px'
          }}
        >
          {loading ? 'Refreshing...' : 'Force Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '4px', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      <div>
        {filteredNotices.length === 0 && !loading && (
          <p style={{ color: '#666' }}>No notices found.</p>
        )}

        {filteredNotices.map((notice, i) => (
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
              <button
                onClick={() => analyzeCompany(notice)}
                disabled={analyzing === notice.id}
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#0891b2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: analyzing === notice.id ? 'wait' : 'pointer',
                  fontSize: '11px',
                  fontWeight: '500'
                }}
              >
                {analyzing === notice.id ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>

            <h3 style={{ margin: '10px 0 0', fontSize: '16px' }}>
              <a href={notice.link} target="_blank" rel="noopener noreferrer" style={{ color: '#1a1a1a', textDecoration: 'none' }}>
                {notice.title || 'Untitled Notice'}
              </a>
            </h3>
          </article>
        ))}
      </div>

      {/* Analysis Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                {analyzing ? 'Analyzing...' : 'Company Analysis'}
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {analysisResult && (
                  <button
                    onClick={downloadPDF}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Download PDF
                  </button>
                )}
                <button
                  onClick={closeModal}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: '20px',
              overflow: 'auto',
              flex: 1
            }}>
              {analyzing && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #e5e5e5',
                    borderTopColor: '#0891b2',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                  }} />
                  <p style={{ color: '#666' }}>Researching company with AI web search...</p>
                  <p style={{ color: '#999', fontSize: '13px' }}>This may take up to 30 seconds</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {analysisError && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  borderRadius: '4px'
                }}>
                  <strong>Error:</strong> {analysisError}
                </div>
              )}

              {analysisResult && (
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: '8px' }}>{analysisResult.companyName}</h3>
                  <p style={{ color: '#666', fontSize: '12px', marginBottom: '20px' }}>
                    Generated: {new Date(analysisResult.generatedAt).toLocaleString()}
                  </p>
                  <div style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}>
                    {analysisResult.analysis}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

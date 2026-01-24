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
  const [analyzing, setAnalyzing] = useState(null)
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

  const formatAnalysis = (text) => {
    if (!text) return null

    // Split by section headers (ALL CAPS lines)
    const sections = text.split(/\n(?=[A-Z][A-Z\s]+\n)/)

    return sections.map((section, i) => {
      const lines = section.trim().split('\n')
      const header = lines[0]
      const content = lines.slice(1).join('\n').trim()

      // Check if first line is a header (ALL CAPS)
      const isHeader = /^[A-Z][A-Z\s]+$/.test(header.trim())

      if (isHeader && content) {
        return (
          <div key={i} style={{ marginBottom: '24px' }}>
            <h4 style={{
              color: '#00d46a',
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '1px',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              {header}
            </h4>
            <div style={{ color: '#e5e5e5', lineHeight: '1.7' }}>
              {content}
            </div>
          </div>
        )
      }

      return (
        <div key={i} style={{ marginBottom: '16px', color: '#e5e5e5', lineHeight: '1.7' }}>
          {section}
        </div>
      )
    })
  }

  const downloadPDF = async () => {
    if (!analysisResult) return

    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - margin * 2

    // Header
    doc.setFillColor(0, 0, 0)
    doc.rect(0, 0, pageWidth, 45, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('INTELLIGENCE REPORT', margin, 25)

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(analysisResult.companyName || 'Company Analysis', margin, 35)

    // Date
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date(analysisResult.generatedAt).toLocaleString()}`, margin, 55)

    // Content
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)

    const lines = doc.splitTextToSize(analysisResult.analysis, maxWidth)
    let y = 65
    const lineHeight = 5
    const pageHeight = doc.internal.pageSize.getHeight()

    for (const line of lines) {
      if (y > pageHeight - 20) {
        doc.addPage()
        y = 20
      }

      // Check for section headers (ALL CAPS)
      if (/^[A-Z][A-Z\s]+$/.test(line.trim())) {
        y += 5
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 150, 80)
        doc.text(line, margin, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)
      } else {
        doc.text(line, margin, y)
      }
      y += lineHeight
    }

    // Footer on each page
    const totalPages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text('Gazette Intelligence Report', margin, pageHeight - 10)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10)
    }

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
    const interval = setInterval(() => fetchNotices(), 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getTypeColor = (code) => {
    if (!code) return '#71717a'
    const c = String(code)
    if (c.startsWith('245')) return '#dc2626'
    if (c.startsWith('244')) return '#ea580c'
    if (c.startsWith('243')) return '#d97706'
    if (c.startsWith('241')) return '#7c3aed'
    if (c.startsWith('250')) return '#0891b2'
    return '#71717a'
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
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: 'Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <header style={{ marginBottom: '32px', borderBottom: '1px solid #27272a', paddingBottom: '16px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '300',
            letterSpacing: '-0.5px'
          }}>
            GAZETTE INSOLVENCY FEED
          </h1>
          <p style={{ margin: '8px 0 0', color: '#71717a', fontSize: '13px' }}>
            Monitoring liquidations, winding up petitions, and administrations
            {cacheInfo && (
              <span>
                {' · '}
                {cacheInfo.cached ? (
                  <>Cached {Math.round(cacheInfo.cacheAge / 60)}m ago</>
                ) : (
                  <span style={{ color: '#00d46a' }}>Fresh data</span>
                )}
                {cacheInfo.stale && <span style={{ color: '#ffa500' }}> (stale)</span>}
              </span>
            )}
          </p>
        </header>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTERS.map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              style={{
                padding: '8px 16px',
                backgroundColor: activeFilter === filter.id ? (filter.color || '#fff') : 'transparent',
                color: activeFilter === filter.id ? '#fff' : '#71717a',
                border: `1px solid ${activeFilter === filter.id ? (filter.color || '#fff') : '#27272a'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
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
              padding: '8px 16px',
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(255,59,59,0.1)',
            border: '1px solid #ff3b3b',
            color: '#ff3b3b',
            borderRadius: '4px',
            marginBottom: '24px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        <div>
          {filteredNotices.length === 0 && !loading && (
            <p style={{ color: '#71717a' }}>No notices found.</p>
          )}

          {filteredNotices.map((notice, i) => (
            <article
              key={notice.id || i}
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                padding: '16px 20px',
                marginBottom: '8px',
                borderRadius: '4px',
                border: '1px solid #27272a',
                borderLeft: `3px solid ${getTypeColor(notice.noticeCode)}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '10px',
                      backgroundColor: getTypeColor(notice.noticeCode),
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '2px',
                      marginRight: '10px',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {notice.noticeType || 'Notice'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#71717a' }}>
                      {notice.published ? new Date(notice.published).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      }) : ''}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '400' }}>
                    <a
                      href={notice.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#fff', textDecoration: 'none' }}
                      onMouseOver={(e) => e.target.style.color = '#00d46a'}
                      onMouseOut={(e) => e.target.style.color = '#fff'}
                    >
                      {notice.title || 'Untitled Notice'}
                    </a>
                  </h3>
                </div>
                <button
                  onClick={() => analyzeCompany(notice)}
                  disabled={analyzing === notice.id}
                  style={{
                    padding: '6px 14px',
                    background: 'linear-gradient(135deg, #00d46a 0%, #00b85c 100%)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: analyzing === notice.id ? 'wait' : 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {analyzing === notice.id ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Analysis Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#0a0a0a',
            border: '1px solid #27272a',
            borderRadius: '8px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #27272a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#000'
            }}>
              <div>
                <p style={{
                  margin: 0,
                  fontSize: '10px',
                  color: '#00d46a',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '4px'
                }}>
                  Intelligence Report
                </p>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '400' }}>
                  {analyzing ? 'Analyzing...' : (analysisResult?.companyName || 'Company Analysis')}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {analysisResult && (
                  <button
                    onClick={downloadPDF}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #00d46a 0%, #00b85c 100%)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Download PDF
                  </button>
                )}
                <button
                  onClick={closeModal}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#71717a',
                    border: '1px solid #27272a',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: '24px',
              overflow: 'auto',
              flex: 1
            }}>
              {analyzing && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    border: '2px solid #27272a',
                    borderTopColor: '#00d46a',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 20px'
                  }} />
                  <p style={{ color: '#fff', marginBottom: '8px' }}>Researching company...</p>
                  <p style={{ color: '#71717a', fontSize: '13px' }}>Searching web, news, and social media</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {analysisError && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(255,59,59,0.1)',
                  border: '1px solid #ff3b3b',
                  color: '#ff3b3b',
                  borderRadius: '4px'
                }}>
                  {analysisError}
                </div>
              )}

              {analysisResult && (
                <div>
                  <p style={{ color: '#71717a', fontSize: '11px', marginBottom: '24px' }}>
                    Generated {new Date(analysisResult.generatedAt).toLocaleString()}
                  </p>
                  <div>
                    {formatAnalysis(analysisResult.analysis)}
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

'use client'
import { useState, useEffect } from 'react'

const FILTERS = [
  { id: 'all', label: 'All', prefixes: null },
  { id: 'petitions', label: 'Winding Up Petitions', prefixes: ['245'] },
  { id: 'liquidations', label: 'Liquidations', prefixes: ['243', '244'] },
  { id: 'administrations', label: 'Administrations', prefixes: ['241'] },
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
              color: '#fff',
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '1px',
              marginBottom: '8px',
              textTransform: 'uppercase',
              borderBottom: '1px solid #27272a',
              paddingBottom: '8px'
            }}>
              {header}
            </h4>
            <div style={{ color: '#a1a1aa', lineHeight: '1.7', fontSize: '13px' }}>
              {content}
            </div>
          </div>
        )
      }

      return (
        <div key={i} style={{ marginBottom: '16px', color: '#a1a1aa', lineHeight: '1.7', fontSize: '13px' }}>
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
        doc.setTextColor(60, 60, 60)
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
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #000; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
          <header style={{ marginBottom: '32px' }}>
            <h1 style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: '500',
              letterSpacing: '2px',
              color: '#71717a',
              textTransform: 'uppercase'
            }}>
              GAZETTE FEED
            </h1>
            <p style={{ margin: '8px 0 0', color: '#52525b', fontSize: '12px' }}>
              UK insolvency notices
              {cacheInfo && (
                <span>
                  {' · '}
                  {cacheInfo.cached ? (
                    <>{Math.round(cacheInfo.cacheAge / 60)}m ago</>
                  ) : (
                    <>live</>
                  )}
                  {cacheInfo.stale && <span style={{ color: '#a1a1aa' }}> (stale)</span>}
                </span>
              )}
            </p>
          </header>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            {FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: activeFilter === filter.id ? '#fff' : 'transparent',
                  color: activeFilter === filter.id ? '#000' : '#52525b',
                  border: `1px solid ${activeFilter === filter.id ? '#fff' : '#27272a'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  transition: 'all 0.15s ease'
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
                backgroundColor: 'transparent',
                color: '#52525b',
                border: '1px solid #27272a',
                borderRadius: '3px',
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              {loading ? '...' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid #991b1b',
              color: '#fca5a5',
              borderRadius: '3px',
              marginBottom: '24px',
              fontSize: '12px'
            }}>
              {error}
            </div>
          )}

          <div>
            {filteredNotices.length === 0 && !loading && (
              <p style={{ color: '#52525b', fontSize: '13px' }}>No notices found.</p>
            )}

            {filteredNotices.map((notice, i) => (
              <article
                key={notice.id || i}
                style={{
                  padding: '14px 0',
                  borderBottom: '1px solid #18181b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '10px',
                      color: '#52525b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {notice.noticeType || 'Notice'}
                    </span>
                    <span style={{ color: '#27272a' }}>·</span>
                    <span style={{ fontSize: '11px', color: '#3f3f46' }}>
                      {notice.published ? new Date(notice.published).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short'
                      }) : ''}
                    </span>
                  </div>
                  <a
                    href={notice.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#e4e4e7',
                      textDecoration: 'none',
                      fontSize: '14px',
                      lineHeight: '1.4',
                      display: 'block'
                    }}
                    onMouseOver={(e) => e.target.style.color = '#fff'}
                    onMouseOut={(e) => e.target.style.color = '#e4e4e7'}
                  >
                    {notice.title || 'Untitled Notice'}
                  </a>
                </div>
                <button
                  onClick={() => analyzeCompany(notice)}
                  disabled={analyzing === notice.id}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: 'transparent',
                    color: '#52525b',
                    border: '1px solid #27272a',
                    borderRadius: '3px',
                    cursor: analyzing === notice.id ? 'wait' : 'pointer',
                    fontSize: '10px',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  onMouseOver={(e) => { if (analyzing !== notice.id) { e.target.style.borderColor = '#3f3f46'; e.target.style.color = '#a1a1aa' }}}
                  onMouseOut={(e) => { e.target.style.borderColor = '#27272a'; e.target.style.color = '#52525b' }}
                >
                  {analyzing === notice.id ? '...' : 'Analyze'}
                </button>
              </article>
            ))}
          </div>
        </div>

        {/* Analysis Modal */}
        {showModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #1f1f1f',
              borderRadius: '4px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #1f1f1f',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    margin: 0,
                    fontSize: '10px',
                    color: '#52525b',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginBottom: '2px'
                  }}>
                    Report
                  </p>
                  <h2 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#e4e4e7',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {analyzing ? 'Analyzing...' : (analysisResult?.companyName || 'Company Analysis')}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {analysisResult && (
                    <button
                      onClick={downloadPDF}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#fff',
                        color: '#000',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      PDF
                    </button>
                  )}
                  <button
                    onClick={closeModal}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'transparent',
                      color: '#52525b',
                      border: '1px solid #27272a',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
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
                padding: '20px',
                overflow: 'auto',
                flex: 1
              }}>
                {analyzing && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      border: '2px solid #27272a',
                      borderTopColor: '#52525b',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 16px'
                    }} />
                    <p style={{ color: '#71717a', fontSize: '12px', margin: 0 }}>Searching...</p>
                  </div>
                )}

                {analysisError && (
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    border: '1px solid #991b1b',
                    color: '#fca5a5',
                    borderRadius: '3px',
                    fontSize: '12px'
                  }}>
                    {analysisError}
                  </div>
                )}

                {analysisResult && (
                  <div>
                    <p style={{ color: '#3f3f46', fontSize: '10px', marginBottom: '20px', marginTop: 0 }}>
                      {new Date(analysisResult.generatedAt).toLocaleString()}
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
    </>
  )
}

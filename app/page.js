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

    // Split by horizontal rule first (separates CH data from web research)
    const mainSections = text.split(/\n---\n/)

    return mainSections.map((mainSection, mainIdx) => {
      // Split by section headers (ALL CAPS lines)
      const sections = mainSection.split(/\n(?=[A-Z][A-Z\s\(\)&]+\n)/)

      return (
        <div key={mainIdx}>
          {mainIdx > 0 && (
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              margin: '32px 0',
              paddingTop: '24px'
            }} />
          )}
          {sections.map((section, i) => {
            const lines = section.trim().split('\n')
            const header = lines[0]
            const content = lines.slice(1).join('\n').trim()

            // Check if first line is a header (ALL CAPS)
            const isHeader = /^[A-Z][A-Z\s\(\)&]+$/.test(header.trim())

            // Special styling for main section headers
            const isMainHeader = header.includes('COMPANIES HOUSE') || header.includes('WEB RESEARCH')

            if (isHeader && content) {
              return (
                <div key={i} style={{ marginBottom: '24px' }}>
                  <h4 style={{
                    color: isMainHeader ? '#fff' : '#F4F4F4',
                    fontSize: isMainHeader ? '12px' : '11px',
                    fontWeight: '600',
                    letterSpacing: '1.5px',
                    marginBottom: isMainHeader ? '16px' : '10px',
                    textTransform: 'uppercase',
                    paddingBottom: isMainHeader ? '8px' : '0',
                    borderBottom: isMainHeader ? '1px solid rgba(255,255,255,0.2)' : 'none'
                  }}>
                    {header}
                  </h4>
                  <div style={{
                    color: '#F4F4F4',
                    lineHeight: '1.7',
                    fontSize: '14px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {content}
                  </div>
                </div>
              )
            }

            if (section.trim()) {
              return (
                <div key={i} style={{
                  marginBottom: '16px',
                  color: '#F4F4F4',
                  lineHeight: '1.7',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {section}
                </div>
              )
            }
            return null
          })}
        </div>
      )
    })
  }

  const downloadPDF = async () => {
    if (!analysisResult) return

    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - margin * 2

    // Header bar
    doc.setFillColor(0, 0, 0)
    doc.rect(0, 0, pageWidth, 50, 'F')

    // Brand name
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('GAZETTE INTELLIGENCE', margin, 18)

    // Company name
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    const companyName = analysisResult.companyName || 'Company Report'
    doc.text(companyName.toUpperCase(), margin, 32)

    // Company number and status
    if (analysisResult.companyNumber) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 200, 200)
      let subline = `#${analysisResult.companyNumber}`
      if (analysisResult.companyStatus) {
        subline += `  |  ${analysisResult.companyStatus.toUpperCase()}`
      }
      doc.text(subline, margin, 43)
    }

    // Date line below header
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(9)
    doc.text(`Report generated ${new Date(analysisResult.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, 60)

    // Process content - clean up the analysis text
    let content = analysisResult.analysis || ''

    // Remove any "---" dividers
    content = content.replace(/\n---\n/g, '\n\n')

    // Remove "WEB RESEARCH" header if it's standalone
    content = content.replace(/\nWEB RESEARCH\n\n/g, '\n\n')

    const lines = doc.splitTextToSize(content.trim(), maxWidth)
    let y = 72
    const lineHeight = 5

    for (const line of lines) {
      if (y > pageHeight - 25) {
        doc.addPage()
        // Mini header on subsequent pages
        doc.setFillColor(0, 0, 0)
        doc.rect(0, 0, pageWidth, 15, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text('GAZETTE INTELLIGENCE', margin, 10)
        doc.setTextColor(150, 150, 150)
        doc.text(companyName, pageWidth - margin - doc.getTextWidth(companyName), 10)
        y = 28
      }

      // Section headers (ALL CAPS lines)
      if (/^[A-Z][A-Z\s\(\)&]+$/.test(line.trim()) && line.trim().length > 3) {
        y += 6
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(0, 0, 0)
        doc.text(line, margin, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        y += 2
      } else if (line.trim()) {
        doc.setTextColor(40, 40, 40)
        doc.text(line, margin, y)
      }
      y += lineHeight
    }

    // Footer on each page
    const totalPages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(220, 220, 220)
      doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text('gazette-feed.railway.app', margin, pageHeight - 10)
      doc.text(`${i} / ${totalPages}`, pageWidth - margin - 10, pageHeight - 10)
    }

    const fileName = `${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_Intelligence_Report.pdf`
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
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
          <header style={{ marginBottom: '40px' }}>
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
            <p style={{ margin: '10px 0 0', color: '#F4F4F4', fontSize: '14px' }}>
              UK insolvency notices
              {cacheInfo && (
                <span style={{ color: '#F4F4F4' }}>
                  {' · '}
                  {cacheInfo.cached ? (
                    <>{Math.round(cacheInfo.cacheAge / 60)}m ago</>
                  ) : (
                    <>live</>
                  )}
                </span>
              )}
            </p>
          </header>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
            {FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                style={{
                  padding: '10px 18px',
                  backgroundColor: activeFilter === filter.id ? '#fff' : 'transparent',
                  color: activeFilter === filter.id ? '#000' : '#F4F4F4',
                  border: `1px solid ${activeFilter === filter.id ? '#fff' : '#F4F4F4'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
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
                padding: '10px 18px',
                backgroundColor: 'transparent',
                color: '#F4F4F4',
                border: '1px solid #F4F4F4',
                borderRadius: '4px',
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              {loading ? '...' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#262626',
              border: '1px solid #dc2626',
              color: '#fff',
              borderRadius: '4px',
              marginBottom: '24px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div>
            {filteredNotices.length === 0 && !loading && (
              <p style={{ color: '#F4F4F4', fontSize: '14px' }}>No notices found.</p>
            )}

            {filteredNotices.map((notice, i) => (
              <article
                key={notice.id || i}
                style={{
                  backgroundColor: '#262626',
                  padding: '20px 24px',
                  marginBottom: '12px',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '20px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontSize: '11px',
                      color: '#F4F4F4',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {notice.noticeType || 'Notice'}
                    </span>
                    <span style={{ color: '#F4F4F4', opacity: 0.5 }}>|</span>
                    <span style={{ fontSize: '12px', color: '#F4F4F4' }}>
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
                      color: '#fff',
                      textDecoration: 'none',
                      fontSize: '15px',
                      fontWeight: '500',
                      lineHeight: '1.4',
                      display: 'block'
                    }}
                    onMouseOver={(e) => e.target.style.opacity = '0.8'}
                    onMouseOut={(e) => e.target.style.opacity = '1'}
                  >
                    {notice.title || 'Untitled Notice'}
                  </a>
                </div>
                <button
                  onClick={() => analyzeCompany(notice)}
                  disabled={analyzing === notice.id}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#F4F4F4',
                    border: '1px solid #F4F4F4',
                    borderRadius: '4px',
                    cursor: analyzing === notice.id ? 'wait' : 'pointer',
                    fontSize: '11px',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => { if (analyzing !== notice.id) { e.target.style.backgroundColor = '#fff'; e.target.style.color = '#000' }}}
                  onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#F4F4F4' }}
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
            backgroundColor: 'rgba(0,0,0,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#262626',
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
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <p style={{
                      margin: 0,
                      fontSize: '11px',
                      color: '#F4F4F4',
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px'
                    }}>
                      Intelligence Report
                    </p>
                    {analysisResult?.sources?.companiesHouse && (
                      <span style={{
                        fontSize: '10px',
                        color: '#000',
                        backgroundColor: '#fff',
                        padding: '2px 8px',
                        borderRadius: '3px',
                        fontWeight: '600',
                        letterSpacing: '0.5px'
                      }}>
                        VERIFIED
                      </span>
                    )}
                  </div>
                  <h2 style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {analyzing ? 'Analyzing...' : (analysisResult?.companyName || 'Company Analysis')}
                  </h2>
                  {analysisResult?.companyNumber && (
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: '12px',
                      color: '#F4F4F4',
                      fontFamily: 'SF Mono, Roboto Mono, monospace'
                    }}>
                      Company #{analysisResult.companyNumber}
                      {analysisResult.companyStatus && (
                        <span style={{
                          marginLeft: '12px',
                          textTransform: 'uppercase',
                          color: analysisResult.companyStatus === 'active' ? '#4ade80' :
                                 analysisResult.companyStatus === 'liquidation' ? '#fbbf24' : '#F4F4F4'
                        }}>
                          {analysisResult.companyStatus}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {analysisResult && (
                    <button
                      onClick={downloadPDF}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: '#fff',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}
                    >
                      Download PDF
                    </button>
                  )}
                  <button
                    onClick={closeModal}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: 'transparent',
                      color: '#F4F4F4',
                      border: '1px solid #F4F4F4',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
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
                      width: '40px',
                      height: '40px',
                      border: '2px solid rgba(255,255,255,0.2)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 20px'
                    }} />
                    <p style={{ color: '#fff', fontSize: '14px', margin: 0 }}>Building intelligence report...</p>
                    <p style={{ color: '#F4F4F4', fontSize: '13px', marginTop: '8px' }}>
                      Querying Companies House, searching web and news
                    </p>
                  </div>
                )}

                {analysisError && (
                  <div style={{
                    padding: '16px 20px',
                    backgroundColor: 'rgba(220,38,38,0.1)',
                    border: '1px solid #dc2626',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}>
                    {analysisError}
                  </div>
                )}

                {analysisResult && (
                  <div>
                    <p style={{ color: '#F4F4F4', fontSize: '12px', marginBottom: '24px', marginTop: 0 }}>
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
    </>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const FILTERS = [
  { id: 'all', label: 'All', prefixes: null },
  { id: 'petitions', label: 'Winding Up Petitions', prefixes: ['245'] },
  { id: 'liquidations', label: 'Liquidations', prefixes: ['243', '244'] },
  { id: 'administrations', label: 'Administrations', prefixes: ['241'] },
]

export default function Home() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
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

  // Financials state - keyed by notice id
  const [financials, setFinancials] = useState({})
  const [loadingFinancials, setLoadingFinancials] = useState({})

  // Blog drafting state
  const [draftingBlog, setDraftingBlog] = useState(null)
  const [blogDraft, setBlogDraft] = useState(null)
  const [showBlogModal, setShowBlogModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState('')

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

  const loadFinancials = async (notice) => {
    const id = notice.id
    if (financials[id] || loadingFinancials[id]) return

    setLoadingFinancials(prev => ({ ...prev, [id]: true }))

    try {
      const res = await fetch(`/api/financials?company=${encodeURIComponent(notice.title)}`)
      const data = await res.json()
      setFinancials(prev => ({ ...prev, [id]: data }))
    } catch (err) {
      setFinancials(prev => ({ ...prev, [id]: { error: err.message } }))
    } finally {
      setLoadingFinancials(prev => ({ ...prev, [id]: false }))
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
          noticeDate: notice.published,
          noticeLink: notice.link
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

  const draftBlogPost = async (notice) => {
    setDraftingBlog(notice.id)
    try {
      const res = await fetch('/api/draft-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: notice.title,
          noticeType: notice.noticeType,
          noticeDate: notice.published,
          noticeLink: notice.link
        })
      })

      const data = await res.json()

      if (data.error) throw new Error(data.error)

      setBlogDraft(data)
      setEditedContent(data.blog)
      setShowBlogModal(true)
    } catch (err) {
      alert(`Failed to draft blog: ${err.message}`)
    } finally {
      setDraftingBlog(null)
    }
  }

  const closeBlogModal = () => {
    setShowBlogModal(false)
    setBlogDraft(null)
    setEditMode(false)
    setEditedContent('')
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editedContent || blogDraft.blog)
    alert('Blog copied to clipboard!')
  }

  const downloadHTML = () => {
    const content = editedContent || blogDraft.blog

    // Wrap in full HTML document with styling
    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${blogDraft.metadata.title || 'Blog Post'}</title>
  <meta name="description" content="${blogDraft.metadata.metaDescription || ''}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 { font-size: 32px; font-weight: 700; margin: 0 0 24px 0; line-height: 1.3; }
    h2 { font-size: 24px; font-weight: 600; margin: 32px 0 16px 0; line-height: 1.4; }
    h3 { font-size: 18px; font-weight: 600; margin: 24px 0 12px 0; line-height: 1.4; }
    p { margin: 0 0 16px 0; }
    ul, ol { margin: 0 0 16px 0; padding-left: 28px; }
    li { margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    table th { background: #f5f5f5; font-weight: 600; text-align: left; padding: 12px 16px; border: 1px solid #ddd; }
    table td { padding: 12px 16px; border: 1px solid #ddd; }
    hr { border: none; border-top: 1px solid #ddd; margin: 32px 0; }
    .meta-description { font-size: 16px; font-style: italic; color: #666; margin-bottom: 32px; padding: 16px; background: #f9f9f9; border-radius: 4px; }
    .footer-meta { font-size: 14px; color: #999; margin-top: 32px; }
  </style>
</head>
<body>
${content}
</body>
</html>`

    const blob = new Blob([fullHTML], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const fileName = `${blogDraft.metadata.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_blog.html`
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  // Check authentication on mount
  useEffect(() => {
    const auth = localStorage.getItem('gazette-auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
      setAuthChecked(true)
    } else {
      router.push('/login')
    }
  }, [router])

  // Fetch notices after authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotices()
      const interval = setInterval(() => fetchNotices(), 30 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  const handleLogout = () => {
    localStorage.removeItem('gazette-auth')
    router.push('/login')
  }

  // Show loading while checking auth
  if (!authChecked || !isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#fff', fontSize: '14px' }}>Loading...</div>
      </div>
    )
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
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #000; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .blog-content h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 24px 0;
          line-height: 1.3;
        }

        .blog-content h2 {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
          margin: 32px 0 16px 0;
          line-height: 1.4;
        }

        .blog-content h3 {
          font-size: 16px;
          font-weight: 600;
          color: #F4F4F4;
          margin: 24px 0 12px 0;
          line-height: 1.4;
        }

        .blog-content p {
          margin: 0 0 16px 0;
          color: #F4F4F4;
          line-height: 1.8;
        }

        .blog-content ul, .blog-content ol {
          margin: 0 0 16px 0;
          padding-left: 24px;
        }

        .blog-content li {
          margin-bottom: 8px;
          color: #F4F4F4;
          line-height: 1.7;
        }

        .blog-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          background: #1a1a1a;
          border-radius: 4px;
          overflow: hidden;
        }

        .blog-content table th {
          background: #000;
          color: #fff;
          font-weight: 600;
          text-align: left;
          padding: 12px 16px;
          border-bottom: 2px solid rgba(255,255,255,0.1);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .blog-content table td {
          padding: 12px 16px;
          color: #F4F4F4;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .blog-content table tr:last-child td {
          border-bottom: none;
        }

        .blog-content hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.1);
          margin: 32px 0;
        }

        .blog-content .meta-description {
          font-size: 14px;
          color: #F4F4F4;
          opacity: 0.8;
          font-style: italic;
          margin-bottom: 32px;
          padding: 16px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
        }

        .blog-content .footer-meta {
          font-size: 12px;
          color: #F4F4F4;
          opacity: 0.6;
          margin-top: 32px;
        }
      `}</style>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
          <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
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
            </div>
            <button
              onClick={handleLogout}
              style={{
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
              }}
              onMouseOver={(e) => { e.target.style.backgroundColor = '#fff'; e.target.style.color = '#000' }}
              onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#F4F4F4' }}
            >
              Logout
            </button>
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

            {filteredNotices.map((notice, i) => {
              const fin = financials[notice.id]
              const finLoading = loadingFinancials[notice.id]

              return (
                <article
                  key={notice.id || i}
                  style={{
                    backgroundColor: '#262626',
                    padding: '20px 24px',
                    marginBottom: '12px',
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
                        {fin?.financials?.netAssetsFormatted && (
                          <>
                            <span style={{ color: '#F4F4F4', opacity: 0.5 }}>|</span>
                            <span style={{
                              fontSize: '12px',
                              color: fin.financials.netAssets < 0 ? '#ef4444' : '#4ade80',
                              fontFamily: 'SF Mono, Roboto Mono, monospace'
                            }}>
                              {fin.financials.netAssetsFormatted}
                            </span>
                          </>
                        )}
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
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      {!fin && (
                        <button
                          onClick={() => loadFinancials(notice)}
                          disabled={finLoading}
                          title="Load financial data"
                          style={{
                            padding: '8px 12px',
                            backgroundColor: 'transparent',
                            color: '#F4F4F4',
                            border: '1px solid #F4F4F4',
                            borderRadius: '4px',
                            cursor: finLoading ? 'wait' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => { if (!finLoading) { e.target.style.backgroundColor = '#fff'; e.target.style.color = '#000' }}}
                          onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#F4F4F4' }}
                        >
                          {finLoading ? '...' : '£'}
                        </button>
                      )}
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
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => { if (analyzing !== notice.id) { e.target.style.backgroundColor = '#fff'; e.target.style.color = '#000' }}}
                        onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#F4F4F4' }}
                      >
                        {analyzing === notice.id ? '...' : 'Analyze'}
                      </button>
                      <button
                        onClick={() => draftBlogPost(notice)}
                        disabled={draftingBlog === notice.id}
                        title="Generate blog post"
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'transparent',
                          color: '#F4F4F4',
                          border: '1px solid #F4F4F4',
                          borderRadius: '4px',
                          cursor: draftingBlog === notice.id ? 'wait' : 'pointer',
                          fontSize: '11px',
                          fontWeight: '500',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => { if (draftingBlog !== notice.id) { e.target.style.backgroundColor = '#fff'; e.target.style.color = '#000' }}}
                        onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#F4F4F4' }}
                      >
                        {draftingBlog === notice.id ? 'Drafting...' : 'Draft Blog'}
                      </button>
                    </div>
                  </div>
                  {fin && fin.financials && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      gap: '24px',
                      flexWrap: 'wrap',
                      fontSize: '12px'
                    }}>
                      {fin.financials.totalAssetsFormatted && (
                        <div>
                          <span style={{ color: '#F4F4F4', opacity: 0.7 }}>Total Assets: </span>
                          <span style={{ color: '#fff', fontFamily: 'SF Mono, Roboto Mono, monospace' }}>
                            {fin.financials.totalAssetsFormatted}
                          </span>
                        </div>
                      )}
                      {fin.financials.netAssetsFormatted && (
                        <div>
                          <span style={{ color: '#F4F4F4', opacity: 0.7 }}>Net Assets: </span>
                          <span style={{
                            color: fin.financials.netAssets < 0 ? '#ef4444' : '#4ade80',
                            fontFamily: 'SF Mono, Roboto Mono, monospace'
                          }}>
                            {fin.financials.netAssetsFormatted}
                          </span>
                        </div>
                      )}
                      {fin.financials.liabilitiesFormatted && (
                        <div>
                          <span style={{ color: '#F4F4F4', opacity: 0.7 }}>Liabilities: </span>
                          <span style={{ color: '#ef4444', fontFamily: 'SF Mono, Roboto Mono, monospace' }}>
                            {fin.financials.liabilitiesFormatted}
                          </span>
                        </div>
                      )}
                      {fin.accountsDate && (
                        <div style={{ marginLeft: 'auto' }}>
                          <span style={{ color: '#F4F4F4', opacity: 0.5 }}>
                            as of {new Date(fin.accountsDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {fin && !fin.financials && fin.message && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '12px',
                      color: '#F4F4F4',
                      opacity: 0.6
                    }}>
                      {fin.message}
                    </div>
                  )}
                </article>
              )
            })}
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

        {/* Blog Draft Modal */}
        {showBlogModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            overflow: 'auto'
          }} onClick={closeBlogModal}>
            <div style={{
              backgroundColor: '#262626',
              borderRadius: '8px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    margin: 0,
                    fontSize: '11px',
                    color: '#F4F4F4',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    marginBottom: '4px'
                  }}>
                    Blog Draft
                  </p>
                  <h2 style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#fff'
                  }}>
                    {blogDraft?.metadata?.companyName || 'Company Blog'}
                  </h2>
                  {blogDraft?.metadata?.companyNumber && (
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: '12px',
                      color: '#F4F4F4',
                      fontFamily: 'SF Mono, Roboto Mono, monospace'
                    }}>
                      Company #{blogDraft.metadata.companyNumber}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={copyToClipboard}
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
                      letterSpacing: '1px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={downloadHTML}
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
                      letterSpacing: '1px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ⬇️ Download HTML
                  </button>
                  <button
                    onClick={toggleEditMode}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: editMode ? '#fff' : 'transparent',
                      color: editMode ? '#000' : '#F4F4F4',
                      border: `1px solid ${editMode ? '#fff' : '#F4F4F4'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {editMode ? '👁️ Preview' : '✏️ Edit'}
                  </button>
                  <button
                    onClick={closeBlogModal}
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
                {editMode ? (
                  <textarea
                    value={editedContent}
                    onChange={e => setEditedContent(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '500px',
                      backgroundColor: '#1a1a1a',
                      color: '#F4F4F4',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '16px',
                      fontSize: '13px',
                      fontFamily: 'SF Mono, Roboto Mono, monospace',
                      lineHeight: '1.6',
                      resize: 'vertical'
                    }}
                  />
                ) : (
                  <div
                    className="blog-content"
                    style={{
                      color: '#F4F4F4',
                      fontSize: '15px',
                      lineHeight: '1.8'
                    }}
                    dangerouslySetInnerHTML={{ __html: editedContent || blogDraft?.blog }}
                  />
                )}
              </div>

              {/* Metadata Footer */}
              {blogDraft?.metadata && (
                <div style={{
                  padding: '20px 24px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  fontSize: '12px'
                }}>
                  <div>
                    <span style={{ color: '#F4F4F4', opacity: 0.7 }}>Word Count: </span>
                    <span style={{
                      color: blogDraft.metadata.wordCount >= 550 && blogDraft.metadata.wordCount <= 750 ? '#4ade80' : '#fbbf24',
                      fontFamily: 'SF Mono, Roboto Mono, monospace',
                      fontWeight: '600'
                    }}>
                      {blogDraft.metadata.wordCount}
                      {blogDraft.metadata.wordCount >= 550 && blogDraft.metadata.wordCount <= 750 ? ' ✓' : ' ⚠️'}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: '#F4F4F4', opacity: 0.7 }}>Primary Keyword: </span>
                    <span style={{ color: '#fff' }}>
                      {blogDraft.metadata.primaryKeyword}
                      {blogDraft.metadata.searchVolume && (
                        <span style={{ color: '#F4F4F4', opacity: 0.7 }}>
                          {' '}({blogDraft.metadata.searchVolume}/mo)
                        </span>
                      )}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: '#F4F4F4', opacity: 0.7 }}>Internal Links: </span>
                    <span style={{ color: '#fff', fontFamily: 'SF Mono, Roboto Mono, monospace' }}>
                      {blogDraft.metadata.internalLinks}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: '#F4F4F4', opacity: 0.7 }}>Generated: </span>
                    <span style={{ color: '#F4F4F4' }}>
                      {new Date(blogDraft.metadata.generatedAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {blogDraft.metadata.validation?.warnings?.length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{
                        backgroundColor: 'rgba(251, 191, 36, 0.1)',
                        border: '1px solid #fbbf24',
                        borderRadius: '4px',
                        padding: '12px',
                        color: '#fbbf24'
                      }}>
                        <strong>⚠️ Warnings:</strong>
                        <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                          {blogDraft.metadata.validation.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

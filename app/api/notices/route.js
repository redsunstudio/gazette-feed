export const dynamic = 'force-dynamic'

// Simple XML parser for Atom feed
function parseAtomFeed(xml) {
  const entries = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]

    const getId = (str) => {
      const m = str.match(/<id>([^<]*)<\/id>/)
      return m ? m[1] : null
    }

    const getTitle = (str) => {
      const m = str.match(/<title[^>]*>([^<]*)<\/title>/)
      return m ? m[1] : null
    }

    const getPublished = (str) => {
      const m = str.match(/<published>([^<]*)<\/published>/)
      return m ? m[1] : null
    }

    const getUpdated = (str) => {
      const m = str.match(/<updated>([^<]*)<\/updated>/)
      return m ? m[1] : null
    }

    const getNoticeCode = (str) => {
      const m = str.match(/<f:notice-code>([^<]*)<\/f:notice-code>/)
      return m ? m[1] : null
    }

    const getCategory = (str) => {
      const m = str.match(/<category[^>]*term="([^"]*)"/)
      return m ? m[1] : null
    }

    const getLink = (str) => {
      // Look for alternate XHTML link first
      const altMatch = str.match(/<link[^>]*rel="alternate"[^>]*type="application\/xhtml\+xml"[^>]*href="([^"]*)"/)
      if (altMatch) return altMatch[1]
      // Fallback to any alternate link
      const anyAlt = str.match(/<link[^>]*rel="alternate"[^>]*href="([^"]*)"/)
      if (anyAlt) return anyAlt[1]
      // Fallback to first link
      const firstLink = str.match(/<link[^>]*href="([^"]*)"/)
      return firstLink ? firstLink[1] : null
    }

    entries.push({
      id: getId(entry),
      title: getTitle(entry),
      published: getPublished(entry),
      updated: getUpdated(entry),
      noticeCode: getNoticeCode(entry),
      category: getCategory(entry),
      link: getLink(entry)
    })
  }

  // Get total count
  const totalMatch = xml.match(/<f:total>([^<]*)<\/f:total>/)
  const total = totalMatch ? parseInt(totalMatch[1], 10) : entries.length

  return { notices: entries, total }
}

export async function GET() {
  try {
    // Try multiple endpoints in order of preference
    const endpoints = [
      'https://www.thegazette.co.uk/insolvency/data.feed?results-page-size=50',
      'https://www.thegazette.co.uk/all-notices/insolvency/data.feed',
    ]

    let xmlText = null
    let lastError = null

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          redirect: 'follow'
        })

        if (response.ok) {
          xmlText = await response.text()
          break
        }
      } catch (e) {
        lastError = e
      }
    }

    if (!xmlText) {
      // Fallback: try the JSON API with no custom headers
      const jsonUrl = 'https://www.thegazette.co.uk/insolvency/data.json?results-page-size=50'
      const jsonResponse = await fetch(jsonUrl, { cache: 'no-store' })

      if (jsonResponse.ok) {
        const jsonData = await jsonResponse.json()
        const notices = (jsonData.entry || []).map(entry => {
          const links = entry.link || []
          const pageLink = links.find(l => l['@rel'] === 'alternate')?.['@href'] || links[1]?.['@href'] || entry.id
          return {
            id: entry.id,
            title: entry.title,
            published: entry.published,
            updated: entry.updated,
            noticeCode: entry['f:notice-code'],
            category: entry.category?.['@term'] || entry.category,
            link: pageLink
          }
        })
        return Response.json({
          notices,
          fetched: new Date().toISOString(),
          total: jsonData['f:total'] || notices.length
        })
      }

      throw new Error(lastError?.message || 'All Gazette endpoints failed')
    }

    // Parse XML to extract entries
    const data = parseAtomFeed(xmlText)

    return Response.json({
      notices: data.notices,
      fetched: new Date().toISOString(),
      total: data.total
    })
  } catch (error) {
    console.error('Error fetching Gazette:', error)
    return Response.json({ error: error.message, notices: [] }, { status: 500 })
  }
}

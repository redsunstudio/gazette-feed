export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const url = 'https://www.thegazette.co.uk/insolvency/notice/data.json?results-page-size=50&sort-by=latest-date'

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Gazette API error: ${response.status} - ${text.slice(0, 200)}`)
    }

    const data = await response.json()

    // Parse the notices from the feed (note: JSON uses @ prefix for attributes)
    const notices = (data.entry || []).map(entry => {
      // Get the notice page link
      const links = entry.link || []
      const pageLink = links.find(l => l['@rel'] === 'alternate' && l['@type'] === 'application/xhtml+xml')?.['@href']
        || links[1]?.['@href']
        || entry.id

      return {
        id: entry.id,
        title: entry.title,
        published: entry.published,
        updated: entry.updated,
        noticeCode: entry['f:notice-code'],
        category: entry.category?.['@term'] || entry.category,
        status: entry['f:status'],
        link: pageLink
      }
    })

    return Response.json({
      notices,
      fetched: new Date().toISOString(),
      total: data['f:total'] || notices.length
    })
  } catch (error) {
    console.error('Error fetching Gazette:', error)
    return Response.json({ error: error.message, notices: [] }, { status: 500 })
  }
}

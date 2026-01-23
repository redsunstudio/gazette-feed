export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get today's date and 7 days ago for the range
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const url = `https://www.thegazette.co.uk/insolvency/notice/data.json?start-publish-date=${weekAgo}&end-publish-date=${today}&sort-by=latest-date&results-page-size=50`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GazetteFeedMonitor/1.0'
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error(`Gazette API error: ${response.status}`)
    }

    const data = await response.json()

    // Parse the notices from the feed
    const notices = (data.entry || []).map(entry => ({
      id: entry.id,
      title: entry.title,
      published: entry.published,
      updated: entry.updated,
      noticeCode: entry['f:notice-code'],
      noticeType: entry['f:notice-type'],
      category: entry['f:notice-category'],
      status: entry['f:status'],
      link: entry.link?.find(l => l.rel === 'alternate')?.href || entry.id,
      content: entry.content?.value || ''
    }))

    return Response.json({
      notices,
      fetched: new Date().toISOString(),
      total: notices.length
    })
  } catch (error) {
    console.error('Error fetching Gazette:', error)
    return Response.json({ error: error.message, notices: [] }, { status: 500 })
  }
}

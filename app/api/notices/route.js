export const dynamic = 'force-dynamic'

// In-memory cache
let cache = {
  data: null,
  timestamp: null
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

// Notice code prefixes we want to show:
// 2410-2419: Administration
// 2430-2439: Winding-up resolutions, liquidator appointments, creditor notices
// 2440-2449: CVL meetings, liquidator appointments
// 2450-2459: Winding up petitions
const ALLOWED_PREFIXES = ['241', '243', '244', '245']

function isAllowedNotice(noticeCode) {
  if (!noticeCode) return false
  const code = String(noticeCode)
  return ALLOWED_PREFIXES.some(prefix => code.startsWith(prefix))
}

function getNoticeType(noticeCode) {
  if (!noticeCode) return 'Notice'
  const code = String(noticeCode)
  if (code.startsWith('245')) return 'Winding Up Petition'
  if (code.startsWith('244')) return 'Liquidation (CVL)'
  if (code.startsWith('243')) return 'Winding Up / Liquidation'
  if (code.startsWith('241')) return 'Administration'
  return 'Insolvency'
}

// Get date string in YYYY-MM-DD format
function formatDate(date) {
  return date.toISOString().split('T')[0]
}

// Fetch a single page of results
async function fetchPage(startDate, endDate, page = 1) {
  const url = `https://www.thegazette.co.uk/insolvency/notice/data.json?results-page-size=100&results-page=${page}&start-publish-date=${startDate}&end-publish-date=${endDate}`

  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Gazette API error: ${response.status}`)
  }

  return response.json()
}

async function fetchFreshData() {
  // Calculate date range (today + prior 7 days)
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 7)

  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(now)

  // Fetch first page to get total count
  const firstPage = await fetchPage(startDateStr, endDateStr, 1)
  const total = parseInt(firstPage['f:total'] || '0', 10)
  const pageSize = 100
  const totalPages = Math.min(Math.ceil(total / pageSize), 10) // Cap at 10 pages (1000 results)

  // Collect all entries from first page
  let allEntries = firstPage.entry || []

  // Fetch remaining pages in parallel (pages 2-10)
  if (totalPages > 1) {
    const pagePromises = []
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(fetchPage(startDateStr, endDateStr, page))
    }

    const pages = await Promise.all(pagePromises)
    for (const pageData of pages) {
      if (pageData.entry) {
        allEntries = allEntries.concat(pageData.entry)
      }
    }
  }

  // Transform and filter entries
  const notices = allEntries
    .map(entry => {
      const links = entry.link || []
      // The human-readable page link has NO @rel attribute (e.g., https://www.thegazette.co.uk/notice/5041183)
      const pageLink = links.find(l => !l['@rel'] && !l['@type'])?.['@href']
        || `https://www.thegazette.co.uk/notice/${entry.id?.split('/').pop()}`
      const noticeCode = entry['f:notice-code']
      return {
        id: entry.id,
        title: entry.title,
        published: entry.published,
        updated: entry.updated,
        noticeCode,
        noticeType: getNoticeType(noticeCode),
        category: entry.category?.['@term'] || entry.category,
        link: pageLink
      }
    })
    .filter(notice => isAllowedNotice(notice.noticeCode))
    .sort((a, b) => new Date(b.published) - new Date(a.published))

  return {
    notices,
    fetched: new Date().toISOString(),
    total: notices.length,
    dateRange: { start: startDateStr, end: endDateStr },
    totalInGazette: total
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    const now = Date.now()
    const cacheAge = cache.timestamp ? now - cache.timestamp : Infinity
    const cacheValid = cache.data && cacheAge < CACHE_TTL

    // Use cache if valid and not forcing refresh
    if (cacheValid && !forceRefresh) {
      return Response.json({
        ...cache.data,
        cached: true,
        cacheAge: Math.round(cacheAge / 1000), // seconds
        nextRefresh: Math.round((CACHE_TTL - cacheAge) / 1000) // seconds until next refresh
      })
    }

    // Fetch fresh data
    const freshData = await fetchFreshData()

    // Update cache
    cache = {
      data: freshData,
      timestamp: now
    }

    return Response.json({
      ...freshData,
      cached: false,
      cacheAge: 0,
      nextRefresh: Math.round(CACHE_TTL / 1000)
    })
  } catch (error) {
    console.error('Error fetching Gazette:', error)

    // If we have cached data and fetch fails, return stale cache
    if (cache.data) {
      return Response.json({
        ...cache.data,
        cached: true,
        stale: true,
        error: error.message
      })
    }

    return Response.json({ error: error.message, notices: [] }, { status: 500 })
  }
}

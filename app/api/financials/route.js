export const dynamic = 'force-dynamic'

const CH_API_KEY = process.env.COMPANIES_HOUSE_API_KEY
const CH_BASE_URL = 'https://api.company-information.service.gov.uk'

// In-memory cache for financials
const financialsCache = new Map()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

async function chFetch(endpoint) {
  const response = await fetch(`${CH_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Basic ${Buffer.from(CH_API_KEY + ':').toString('base64')}`
    }
  })

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Companies House API error: ${response.status}`)
  }

  return response.json()
}

// Search for company by name
async function searchCompany(companyName) {
  const searchTerm = companyName
    .replace(/\s*(LIMITED|LTD|PLC|LLP)\.?\s*$/i, '')
    .trim()

  const data = await chFetch(`/search/companies?q=${encodeURIComponent(searchTerm)}&items_per_page=5`)

  if (!data?.items?.length) return null

  // Try exact match first
  const exactMatch = data.items.find(item =>
    item.title.toLowerCase() === companyName.toLowerCase()
  )
  if (exactMatch) return exactMatch

  // Then companies in liquidation or active
  const relevantCompany = data.items.find(item =>
    item.company_status === 'liquidation' || item.company_status === 'active'
  )
  if (relevantCompany) return relevantCompany

  return data.items[0]
}

// Get filing history for accounts
async function getAccountsFilings(companyNumber) {
  const data = await chFetch(`/company/${companyNumber}/filing-history?category=accounts&items_per_page=5`)
  return data?.items || []
}

// Fetch and parse iXBRL document
async function fetchAndParseAccounts(companyNumber, transactionId) {
  // Companies House serves accounts as HTML with embedded iXBRL
  const documentUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}/filing-history/${transactionId}/document?format=xhtml`

  try {
    const response = await fetch(documentUrl, {
      headers: {
        'Accept': 'application/xhtml+xml, text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; GazetteFeed/1.0)'
      },
      redirect: 'follow'
    })

    if (!response.ok) {
      console.error(`Document fetch failed: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Parse iXBRL tags from the HTML
    // Common XBRL tags for UK accounts (FRS 101, FRS 102, UK GAAP)
    const financials = {}

    // Extract values using regex for iXBRL tags
    // Format: <ix:nonFraction ... name="ns:TagName" ...>VALUE</ix:nonFraction>

    // Total/Net Assets patterns
    const netAssetsPatterns = [
      /name="[^"]*(?:NetAssetsLiabilities|TotalNetAssets|NetAssets)"[^>]*>([^<]+)</gi,
      /name="[^"]*(?:TotalAssetsLessCurrentLiabilities)"[^>]*>([^<]+)</gi
    ]

    // Total Assets patterns
    const totalAssetsPatterns = [
      /name="[^"]*(?:TotalAssets|FixedAssetsPlusCurrentAssets)"[^>]*>([^<]+)</gi
    ]

    // Current Assets patterns
    const currentAssetsPatterns = [
      /name="[^"]*(?:CurrentAssets|TotalCurrentAssets)"[^>]*>([^<]+)</gi
    ]

    // Fixed Assets patterns
    const fixedAssetsPatterns = [
      /name="[^"]*(?:FixedAssets|TotalFixedAssets|TangibleFixedAssets)"[^>]*>([^<]+)</gi
    ]

    // Creditors/Liabilities patterns
    const liabilitiesPatterns = [
      /name="[^"]*(?:CreditorsDueWithinOneYear|CurrentLiabilities)"[^>]*>([^<]+)</gi,
      /name="[^"]*(?:TotalCreditors|TotalLiabilities)"[^>]*>([^<]+)</gi
    ]

    // Extract values - take the last (most recent) value found
    function extractValue(patterns) {
      for (const pattern of patterns) {
        const matches = [...html.matchAll(pattern)]
        if (matches.length > 0) {
          // Get the last match (usually current year)
          const lastMatch = matches[matches.length - 1]
          const value = parseFloat(lastMatch[1].replace(/,/g, '').replace(/\s/g, ''))
          if (!isNaN(value)) {
            return value
          }
        }
      }
      return null
    }

    financials.netAssets = extractValue(netAssetsPatterns)
    financials.totalAssets = extractValue(totalAssetsPatterns)
    financials.currentAssets = extractValue(currentAssetsPatterns)
    financials.fixedAssets = extractValue(fixedAssetsPatterns)
    financials.liabilities = extractValue(liabilitiesPatterns)

    // Try alternative: look for table-based values with common labels
    if (!financials.netAssets && !financials.totalAssets) {
      // Look for "Total assets less current liabilities" or "Net assets" in text
      const netAssetsTextMatch = html.match(/(?:Net\s*assets|Total\s*assets\s*less\s*current\s*liabilities)[^£$\d]*[£$]?\s*([\d,]+)/i)
      if (netAssetsTextMatch) {
        const value = parseFloat(netAssetsTextMatch[1].replace(/,/g, ''))
        if (!isNaN(value)) {
          financials.netAssets = value
        }
      }
    }

    // Check if we found anything useful
    const hasData = Object.values(financials).some(v => v !== null)

    return hasData ? financials : null

  } catch (error) {
    console.error('Error fetching/parsing accounts:', error)
    return null
  }
}

// Format currency
function formatCurrency(value) {
  if (value === null || value === undefined) return null

  const absValue = Math.abs(value)
  const isNegative = value < 0

  let formatted
  if (absValue >= 1000000) {
    formatted = `£${(absValue / 1000000).toFixed(1)}m`
  } else if (absValue >= 1000) {
    formatted = `£${(absValue / 1000).toFixed(0)}k`
  } else {
    formatted = `£${absValue.toFixed(0)}`
  }

  return isNegative ? `-${formatted}` : formatted
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyName = searchParams.get('company')

    if (!companyName) {
      return Response.json({ error: 'Company name required' }, { status: 400 })
    }

    if (!CH_API_KEY) {
      return Response.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Check cache
    const cacheKey = companyName.toLowerCase()
    const cached = financialsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Response.json({ ...cached.data, cached: true })
    }

    // Search for company
    const company = await searchCompany(companyName)

    if (!company?.company_number) {
      return Response.json({
        found: false,
        companyName,
        message: 'Company not found'
      })
    }

    // Get accounts filings
    const filings = await getAccountsFilings(company.company_number)

    if (!filings.length) {
      const result = {
        found: true,
        companyName: company.title,
        companyNumber: company.company_number,
        financials: null,
        message: 'No accounts filed'
      }
      financialsCache.set(cacheKey, { data: result, timestamp: Date.now() })
      return Response.json(result)
    }

    // Get the most recent accounts
    const latestAccounts = filings[0]
    const transactionId = latestAccounts.transaction_id

    // Fetch and parse the accounts document
    const financials = await fetchAndParseAccounts(company.company_number, transactionId)

    const result = {
      found: true,
      companyName: company.title,
      companyNumber: company.company_number,
      accountsDate: latestAccounts.date,
      accountsType: latestAccounts.description,
      financials: financials ? {
        netAssets: financials.netAssets,
        netAssetsFormatted: formatCurrency(financials.netAssets),
        totalAssets: financials.totalAssets,
        totalAssetsFormatted: formatCurrency(financials.totalAssets),
        currentAssets: financials.currentAssets,
        currentAssetsFormatted: formatCurrency(financials.currentAssets),
        fixedAssets: financials.fixedAssets,
        fixedAssetsFormatted: formatCurrency(financials.fixedAssets),
        liabilities: financials.liabilities,
        liabilitiesFormatted: formatCurrency(financials.liabilities)
      } : null,
      message: financials ? 'Financials extracted' : 'Could not parse accounts'
    }

    // Cache the result
    financialsCache.set(cacheKey, { data: result, timestamp: Date.now() })

    return Response.json(result)

  } catch (error) {
    console.error('Financials error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

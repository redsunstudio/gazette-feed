import Anthropic from '@anthropic-ai/sdk'
import { blogCache, BLOG_TTL } from '../../../lib/blog-cache.js'
import { generateLinkedInPrompt } from '../../../lib/blog-prompts.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const CH_API_KEY = process.env.COMPANIES_HOUSE_API_KEY
const CH_BASE_URL = 'https://api.company-information.service.gov.uk'

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

async function searchCompany(companyName) {
  const searchTerm = companyName
    .replace(/\s*(LIMITED|LTD|PLC|LLP)\.?\s*$/i, '')
    .trim()

  const data = await chFetch(`/search/companies?q=${encodeURIComponent(searchTerm)}&items_per_page=5`)

  if (!data?.items?.length) return null

  const exactMatch = data.items.find(item =>
    item.title.toLowerCase() === companyName.toLowerCase()
  )
  if (exactMatch) return exactMatch

  const relevantCompany = data.items.find(item =>
    item.company_status === 'liquidation' || item.company_status === 'active'
  )
  if (relevantCompany) return relevantCompany

  return data.items[0]
}

async function getCompanyProfile(companyNumber) {
  return chFetch(`/company/${companyNumber}`)
}

async function getOfficers(companyNumber) {
  const data = await chFetch(`/company/${companyNumber}/officers?items_per_page=50`)
  return data?.items || []
}

async function getPSCs(companyNumber) {
  const data = await chFetch(`/company/${companyNumber}/persons-with-significant-control?items_per_page=50`)
  return data?.items || []
}

async function getFinancials(companyNumber) {
  try {
    const filings = await chFetch(`/company/${companyNumber}/filing-history?category=accounts&items_per_page=5`)

    if (!filings?.items?.length) return { financials: null, accountsDate: null }

    const latestAccounts = filings.items[0]
    const transactionId = latestAccounts.transaction_id

    const documentUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}/filing-history/${transactionId}/document?format=xhtml`

    const response = await fetch(documentUrl, {
      headers: {
        'Accept': 'application/xhtml+xml, text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; GazetteFeed/1.0)'
      },
      redirect: 'follow'
    })

    if (!response.ok) {
      return { financials: null, accountsDate: latestAccounts.date }
    }

    const html = await response.text()
    const financials = {}

    function extractValue(patterns) {
      for (const pattern of patterns) {
        const matches = [...html.matchAll(pattern)]
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1]
          const value = parseFloat(lastMatch[1].replace(/,/g, '').replace(/\s/g, ''))
          if (!isNaN(value)) return value
        }
      }
      return null
    }

    financials.netAssets = extractValue([
      /name="[^"]*(?:NetAssetsLiabilities|TotalNetAssets|NetAssets)"[^>]*>([^<]+)</gi,
      /name="[^"]*(?:TotalAssetsLessCurrentLiabilities)"[^>]*>([^<]+)</gi
    ])
    financials.totalAssets = extractValue([
      /name="[^"]*(?:TotalAssets|FixedAssetsPlusCurrentAssets)"[^>]*>([^<]+)</gi
    ])
    financials.currentAssets = extractValue([
      /name="[^"]*(?:CurrentAssets|TotalCurrentAssets)"[^>]*>([^<]+)</gi
    ])
    financials.liabilities = extractValue([
      /name="[^"]*(?:CreditorsDueWithinOneYear|CurrentLiabilities)"[^>]*>([^<]+)</gi,
      /name="[^"]*(?:TotalCreditors|TotalLiabilities)"[^>]*>([^<]+)</gi
    ])

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

    const hasData = Object.values(financials).some(v => v !== null)
    if (!hasData) return { financials: null, accountsDate: latestAccounts.date }

    return {
      financials: {
        netAssets: financials.netAssets,
        netAssetsFormatted: formatCurrency(financials.netAssets),
        totalAssets: financials.totalAssets,
        totalAssetsFormatted: formatCurrency(financials.totalAssets),
        currentAssets: financials.currentAssets,
        currentAssetsFormatted: formatCurrency(financials.currentAssets),
        liabilities: financials.liabilities,
        liabilitiesFormatted: formatCurrency(financials.liabilities)
      },
      accountsDate: latestAccounts.date
    }
  } catch (error) {
    console.error('Error fetching financials:', error)
    return { financials: null, accountsDate: null }
  }
}

export async function POST(request) {
  try {
    const { companyName, noticeType, noticeDate, noticeLink } = await request.json()

    if (!companyName) {
      return Response.json({ error: 'Company name is required' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    // Separate cache namespace from blog posts
    const cacheKey = blogCache.generateKey(companyName + '_linkedin', noticeType || 'insolvency')
    const cached = blogCache.get(cacheKey)

    if (cached) {
      return Response.json({ ...cached, cached: true })
    }

    // Fetch Companies House data
    let companyData = null
    let officers = []
    let pscs = []
    let financialData = { financials: null, accountsDate: null }
    let companyNumber = null

    if (CH_API_KEY) {
      try {
        const searchResult = await searchCompany(companyName)

        if (searchResult?.company_number) {
          companyNumber = searchResult.company_number

          const [profile, officerData, pscData, finData] = await Promise.all([
            getCompanyProfile(companyNumber),
            getOfficers(companyNumber),
            getPSCs(companyNumber),
            getFinancials(companyNumber)
          ])

          companyData = profile
          officers = officerData
          pscs = pscData
          financialData = finData
        }
      } catch (err) {
        console.error('Companies House error:', err)
      }
    }

    // Generate LinkedIn post with Claude
    const prompt = generateLinkedInPrompt({
      companyName,
      companyNumber,
      noticeType: noticeType || 'Administration',
      noticeDate: noticeDate || 'Recent',
      noticeLink: noticeLink || 'https://www.thegazette.co.uk',
      companiesHouseData: companyData,
      officers,
      pscs,
      financials: financialData.financials,
      accountsDate: financialData.accountsDate
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })

    let postText = ''
    for (const block of response.content) {
      if (block.type === 'text') postText += block.text
    }

    if (!postText) {
      throw new Error('No LinkedIn post content generated')
    }

    postText = postText.trim()

    const result = {
      post: postText,
      metadata: {
        companyName: companyData?.company_name || companyName,
        companyNumber,
        characterCount: postText.length,
        generatedAt: new Date().toISOString(),
        sources: {
          companiesHouse: !!companyData,
          financials: !!financialData.financials
        }
      }
    }

    blogCache.set(cacheKey, result, BLOG_TTL)

    return Response.json(result)

  } catch (error) {
    console.error('LinkedIn post generation error:', error)
    return Response.json(
      { error: error.message || 'Failed to generate LinkedIn post' },
      { status: 500 }
    )
  }
}

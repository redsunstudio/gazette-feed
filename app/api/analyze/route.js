import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const CH_API_KEY = process.env.COMPANIES_HOUSE_API_KEY
const CH_BASE_URL = 'https://api.company-information.service.gov.uk'

// Companies House API helper
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
  // Clean up company name for search
  const searchTerm = companyName
    .replace(/\s*(LIMITED|LTD|PLC|LLP)\.?\s*$/i, '')
    .trim()

  const data = await chFetch(`/search/companies?q=${encodeURIComponent(searchTerm)}&items_per_page=5`)

  if (!data?.items?.length) return null

  // Try to find best match - prefer active companies, exact matches
  const items = data.items

  // First try exact match (case insensitive)
  const exactMatch = items.find(item =>
    item.title.toLowerCase() === companyName.toLowerCase()
  )
  if (exactMatch) return exactMatch

  // Then try active companies
  const activeCompany = items.find(item =>
    item.company_status === 'active' || item.company_status === 'liquidation'
  )
  if (activeCompany) return activeCompany

  // Return first result
  return items[0]
}

// Get full company profile
async function getCompanyProfile(companyNumber) {
  return chFetch(`/company/${companyNumber}`)
}

// Get company officers (directors, secretaries)
async function getOfficers(companyNumber) {
  const data = await chFetch(`/company/${companyNumber}/officers?items_per_page=50`)
  return data?.items || []
}

// Get People of Significant Control
async function getPSCs(companyNumber) {
  const data = await chFetch(`/company/${companyNumber}/persons-with-significant-control?items_per_page=50`)
  return data?.items || []
}

// Format address from Companies House format
function formatAddress(addr) {
  if (!addr) return 'Not available'
  const parts = [
    addr.premises,
    addr.address_line_1,
    addr.address_line_2,
    addr.locality,
    addr.region,
    addr.postal_code,
    addr.country
  ].filter(Boolean)
  return parts.join(', ')
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Get SIC code descriptions
const SIC_CODES = {
  '62011': 'Computer programming activities',
  '62012': 'Business and domestic software development',
  '62020': 'Information technology consultancy activities',
  '62090': 'Other information technology service activities',
  '70229': 'Management consultancy activities',
  '82990': 'Other business support service activities',
  '47910': 'Retail sale via mail order or internet',
  '56101': 'Restaurants and cafes',
  '41100': 'Development of building projects',
  '68100': 'Buying and selling of own real estate',
  '68209': 'Other letting and operating of own or leased real estate'
}

function getSICDescription(code) {
  return SIC_CODES[code] || `SIC ${code}`
}

export async function POST(request) {
  try {
    const { companyName, noticeType, noticeDate } = await request.json()

    if (!companyName) {
      return Response.json({ error: 'Company name is required' }, { status: 400 })
    }

    // Step 1: Search Companies House
    let companyData = null
    let officers = []
    let pscs = []
    let chError = null

    if (CH_API_KEY) {
      try {
        const searchResult = await searchCompany(companyName)

        if (searchResult?.company_number) {
          const companyNumber = searchResult.company_number

          // Fetch all data in parallel
          const [profile, officerData, pscData] = await Promise.all([
            getCompanyProfile(companyNumber),
            getOfficers(companyNumber),
            getPSCs(companyNumber)
          ])

          companyData = profile
          officers = officerData
          pscs = pscData
        }
      } catch (err) {
        console.error('Companies House error:', err)
        chError = err.message
      }
    }

    // Step 2: Build Companies House section
    let companiesHouseInfo = ''

    if (companyData) {
      companiesHouseInfo = `
COMPANIES HOUSE VERIFIED DATA

COMPANY DETAILS
Company Name: ${companyData.company_name}
Company Number: ${companyData.company_number}
Status: ${companyData.company_status?.toUpperCase() || 'Unknown'}
Type: ${companyData.type || 'Unknown'}
Incorporated: ${formatDate(companyData.date_of_creation)}
${companyData.date_of_cessation ? `Dissolved: ${formatDate(companyData.date_of_cessation)}` : ''}

REGISTERED ADDRESS
${formatAddress(companyData.registered_office_address)}

${companyData.sic_codes?.length ? `INDUSTRY CODES\n${companyData.sic_codes.map(code => `${code}: ${getSICDescription(code)}`).join('\n')}` : ''}

OFFICERS (DIRECTORS & SECRETARIES)
${officers.length ? officers.map(o => {
  const role = o.officer_role?.replace(/_/g, ' ').toUpperCase() || 'OFFICER'
  const name = o.name
  const appointed = o.appointed_on ? `Appointed: ${formatDate(o.appointed_on)}` : ''
  const resigned = o.resigned_on ? `Resigned: ${formatDate(o.resigned_on)}` : 'Current'
  const occupation = o.occupation ? `Occupation: ${o.occupation}` : ''
  return `${name}\n  Role: ${role}\n  ${appointed} | ${resigned}${occupation ? `\n  ${occupation}` : ''}`
}).join('\n\n') : 'No officers found'}

PERSONS WITH SIGNIFICANT CONTROL (SHAREHOLDERS/CONTROLLERS)
${pscs.length ? pscs.map(p => {
  const name = p.name || p.name_elements?.forename + ' ' + p.name_elements?.surname || 'Unknown'
  const nature = p.natures_of_control?.join(', ') || 'Control details not specified'
  const notified = p.notified_on ? `Notified: ${formatDate(p.notified_on)}` : ''
  return `${name}\n  ${nature}\n  ${notified}`
}).join('\n\n') : 'No PSCs found or company exempt'}
`
    } else if (chError) {
      companiesHouseInfo = `\nCOMPANIES HOUSE: Unable to fetch data - ${chError}\n`
    } else if (!CH_API_KEY) {
      companiesHouseInfo = `\nCOMPANIES HOUSE: API key not configured\n`
    } else {
      companiesHouseInfo = `\nCOMPANIES HOUSE: No matching company found for "${companyName}"\n`
    }

    // Step 3: Use Claude with web search for additional intelligence
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const webSearchPrompt = `You are a business intelligence analyst. I need you to search the web for additional information about this UK company.

Company Name: ${companyName}
${companyData ? `Company Number: ${companyData.company_number}` : ''}
Notice Type: ${noticeType || 'Insolvency'}
Notice Date: ${noticeDate || 'Recent'}

I already have Companies House data. Now search the web to find:

1. COMPANY WEBSITE
Find the official company website URL if it exists. Check if it's still active.

2. SOCIAL MEDIA ACCOUNTS
Search for the company on:
- LinkedIn (company page)
- Twitter/X
- Facebook
- Instagram
Look for official accounts and note follower counts if visible.

3. RECENT NEWS (Last 30 Days)
Search for any news articles, press releases, or media coverage about this company from the past month. Include:
- Publication name
- Headline
- Date
- Brief summary

4. BUSINESS ANALYSIS
Based on what you find:
- What does/did this company actually do?
- Any visible signs of trouble before insolvency?
- Customer reviews or complaints?
- Any connected companies or group structure?

FORMATTING RULES:
- Use plain text only, NO markdown (no **, no ##, no bullets like -)
- Use ALL CAPS for section headers
- Use line breaks to separate items
- Be specific with URLs and dates
- State clearly if you cannot find something`

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: webSearchPrompt
        }
      ],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 10
        }
      ]
    })

    // Extract text from response
    let webSearchResults = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        webSearchResults += block.text
      }
    }

    // Combine all intelligence
    const fullAnalysis = `${companiesHouseInfo}

---

WEB RESEARCH

${webSearchResults}
`

    return Response.json({
      analysis: fullAnalysis,
      companyName: companyData?.company_name || companyName,
      companyNumber: companyData?.company_number || null,
      companyStatus: companyData?.company_status || null,
      generatedAt: new Date().toISOString(),
      sources: {
        companiesHouse: !!companyData,
        webSearch: true
      }
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return Response.json(
      { error: error.message || 'Failed to analyze company' },
      { status: 500 }
    )
  }
}

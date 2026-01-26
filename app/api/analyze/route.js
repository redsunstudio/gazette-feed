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
      const sections = []

      // Company details - always include if we have data
      const details = [
        `Company Name: ${companyData.company_name}`,
        `Company Number: ${companyData.company_number}`,
        `Status: ${companyData.company_status?.toUpperCase() || 'Unknown'}`,
        companyData.type ? `Type: ${companyData.type}` : null,
        `Incorporated: ${formatDate(companyData.date_of_creation)}`,
        companyData.date_of_cessation ? `Dissolved: ${formatDate(companyData.date_of_cessation)}` : null
      ].filter(Boolean)

      sections.push(`COMPANY DETAILS\n${details.join('\n')}`)

      // Address
      const address = formatAddress(companyData.registered_office_address)
      if (address && address !== 'Not available') {
        sections.push(`REGISTERED ADDRESS\n${address}`)
      }

      // SIC codes
      if (companyData.sic_codes?.length) {
        sections.push(`INDUSTRY CODES\n${companyData.sic_codes.map(code => `${code}: ${getSICDescription(code)}`).join('\n')}`)
      }

      // Officers - only if we have them
      if (officers.length) {
        const officerList = officers.map(o => {
          const role = o.officer_role?.replace(/_/g, ' ').toUpperCase() || 'OFFICER'
          const name = o.name
          const appointed = o.appointed_on ? `Appointed: ${formatDate(o.appointed_on)}` : ''
          const resigned = o.resigned_on ? `Resigned: ${formatDate(o.resigned_on)}` : 'Current'
          const occupation = o.occupation ? `Occupation: ${o.occupation}` : ''
          return `${name}\n  Role: ${role}\n  ${appointed} | ${resigned}${occupation ? `\n  ${occupation}` : ''}`
        }).join('\n\n')
        sections.push(`OFFICERS\n${officerList}`)
      }

      // PSCs - only if we have them
      if (pscs.length) {
        const pscList = pscs.map(p => {
          const name = p.name || (p.name_elements ? `${p.name_elements.forename} ${p.name_elements.surname}` : null)
          if (!name) return null
          const nature = p.natures_of_control?.join(', ')
          const notified = p.notified_on ? `Notified: ${formatDate(p.notified_on)}` : ''
          return `${name}${nature ? `\n  ${nature}` : ''}${notified ? `\n  ${notified}` : ''}`
        }).filter(Boolean).join('\n\n')

        if (pscList) {
          sections.push(`PERSONS WITH SIGNIFICANT CONTROL\n${pscList}`)
        }
      }

      companiesHouseInfo = `COMPANIES HOUSE VERIFIED DATA\n\n${sections.join('\n\n')}`
    }

    // Step 3: Use Claude with web search for additional intelligence
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const webSearchPrompt = `You are a business intelligence analyst researching a UK company facing insolvency.

Company Name: ${companyName}
${companyData ? `Company Number: ${companyData.company_number}` : ''}
Notice Type: ${noticeType || 'Insolvency'}
Notice Date: ${noticeDate || 'Recent'}

Search the web and compile findings. IMPORTANT: Only include sections where you find actual information. Do NOT include any section if you cannot find relevant data for it.

SECTIONS TO RESEARCH (only include if found):

WEBSITE
The official company website URL if it exists.

SOCIAL MEDIA
LinkedIn, Twitter/X, Facebook, or Instagram accounts. Include URLs and follower counts if visible.

RECENT NEWS
News articles or press coverage from the past month. Include publication, headline, date, and brief summary.

BUSINESS OVERVIEW
What the company does/did, their products or services, and any notable information about their operations.

WARNING SIGNS
Any visible signs of trouble before insolvency - customer complaints, reviews, legal issues, or red flags.

CONNECTED ENTITIES
Parent companies, subsidiaries, or related businesses.

CRITICAL FORMATTING RULES:
- ONLY include sections where you found actual information
- Do NOT write "not found", "no results", "could not find", or similar phrases
- Do NOT include empty sections
- Use plain text only, NO markdown (no **, no ##, no -)
- Use ALL CAPS for section headers
- Use line breaks to separate items
- Be specific with URLs and dates`

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

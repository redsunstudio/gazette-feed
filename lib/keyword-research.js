// Keyword research integration via DataForSEO MCP
// Fallback to constructed keywords if API unavailable

// Check if MCP tools are available (runtime detection)
function hasMCPTools() {
  return typeof process !== 'undefined' &&
         process.env.MCP_ENABLED === 'true'
}

// Call DataForSEO via MCP (would be handled by MCP server in practice)
// This is a placeholder - actual MCP integration happens at runtime
async function callDataForSEO(query) {
  // In production, this would call the MCP tool
  // For now, return mock data structure
  return {
    data: [
      {
        keyword: query,
        search_volume: null,
        competition: null
      }
    ]
  }
}

// Extract company name and industry for keyword generation
function parseCompanyContext(companyName, sicCodes, sicDescriptions) {
  // Get primary industry from first SIC code
  let industry = 'business'

  if (sicCodes && sicCodes.length > 0) {
    const firstCode = sicCodes[0]
    const description = sicDescriptions?.[firstCode]

    if (description) {
      // Extract key industry term
      const industryTerms = description.toLowerCase()
        .replace(/activities?|services?|support|other/gi, '')
        .trim()
        .split(/\s+/)
        .filter(t => t.length > 3)

      if (industryTerms.length > 0) {
        industry = industryTerms[0]
      }
    }
  }

  return { companyName, industry }
}

// Generate fallback keywords when API unavailable
function generateFallbackKeywords(companyName, noticeType, industry) {
  // Normalize notice type
  const normalizedType = noticeType.toLowerCase()
    .replace(/winding.?up/i, 'liquidation')
    .replace(/petition/i, '')
    .trim() || 'administration'

  // Primary keyword: company name + insolvency type
  const primary = {
    keyword: `${companyName} ${normalizedType}`,
    volume: null,
    competition: null,
    source: 'fallback'
  }

  // Secondary keywords
  const secondary = [
    `${companyName} insolvency`,
    `${companyName} liquidation`,
    `${normalizedType} ${industry} UK`
  ]

  // Related terms for context
  const related = [
    'administration process UK',
    'insolvency practitioners',
    'company rescue',
    'distressed M&A',
    'business insolvency',
    'creditors voluntary liquidation',
    'pre-pack administration',
    'asset acquisition',
    'distressed business buyers',
    'insolvency notice UK'
  ]

  return {
    primary,
    secondary,
    related,
    industry
  }
}

// Main keyword research function
export async function getKeywordData(companyName, noticeType, sicCodes, sicDescriptions) {
  const { industry } = parseCompanyContext(companyName, sicCodes, sicDescriptions)

  // Try DataForSEO if MCP tools available
  if (hasMCPTools()) {
    try {
      const queries = [
        `${companyName} administration`,
        `${companyName} insolvency`,
        `${industry} administration UK`,
        `distressed ${industry} acquisition`
      ]

      // Call DataForSEO for each query
      const results = await Promise.all(
        queries.map(q => callDataForSEO(q))
      )

      // Parse results
      if (results.length > 0 && results[0].data?.length > 0) {
        const primary = results[0].data[0]
        const secondary = results.slice(1, 4)
          .filter(r => r.data?.length > 0)
          .map(r => r.data[0].keyword)

        // Generate related terms (would come from DataForSEO related keywords in production)
        const related = [
          'administration process UK',
          'insolvency practitioners',
          'company rescue',
          'distressed acquisition',
          `${industry} insolvency`,
          'business buyers UK',
          'distressed M&A',
          'pre-pack administration',
          'creditor protection',
          'asset purchase'
        ]

        return {
          primary: {
            keyword: primary.keyword,
            volume: primary.search_volume,
            competition: primary.competition,
            source: 'dataforseo'
          },
          secondary,
          related,
          industry
        }
      }
    } catch (error) {
      console.error('DataForSEO error:', error)
      // Fall through to fallback
    }
  }

  // Fallback to constructed keywords
  return generateFallbackKeywords(companyName, noticeType, industry)
}

// Calculate keyword density in text
export function calculateKeywordDensity(text, keyword) {
  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()

  // Count occurrences
  let count = 0
  let pos = 0

  while ((pos = lowerText.indexOf(lowerKeyword, pos)) !== -1) {
    count++
    pos += lowerKeyword.length
  }

  // Calculate density (as percentage of total words)
  const words = text.split(/\s+/).length
  const density = words > 0 ? (count / words) * 100 : 0

  return {
    count,
    density: density.toFixed(2),
    targetRange: [0.5, 2.0], // 0.5% - 2.0% is generally good
    withinTarget: density >= 0.5 && density <= 2.0
  }
}

// Export for testing
export { generateFallbackKeywords, parseCompanyContext }

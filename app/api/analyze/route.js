import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for analysis

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request) {
  try {
    const { companyName, noticeType, noticeDate } = await request.json()

    if (!companyName) {
      return Response.json({ error: 'Company name is required' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'API key not configured' }, { status: 500 })
    }

    const prompt = `You are a business intelligence analyst researching a company from a UK Gazette insolvency notice.

Company: ${companyName}
Notice Type: ${noticeType || 'Insolvency'}
Notice Date: ${noticeDate || 'Recent'}

Search the web thoroughly and compile a detailed intelligence report. Focus on finding SPECIFIC, ACTIONABLE information.

IMPORTANT FORMATTING RULES:
- Use plain text only, NO markdown symbols (no **, no ##, no *, no bullets like -)
- Use ALL CAPS for section headers
- Use line breaks to separate sections
- Present lists with simple line breaks, not bullet points

Include these sections:

COMPANY DETAILS
Full registered company name, company registration number, date of incorporation, registered office address (full address with postcode), trading addresses if different.

KEY PEOPLE
Names of all directors, officers, shareholders, and key personnel. Include their roles and any other companies they are associated with. List each person on a new line with their role.

CONTACT INFORMATION
Any phone numbers, email addresses, website URLs, or social media profiles found for the company or key individuals.

BUSINESS OVERVIEW
What the company does/did, industry sector, size, number of employees if known.

FINANCIAL SUMMARY
Latest available accounts, turnover, assets, liabilities, any CCJs or charges registered.

NEWS AND HEADLINES
Recent news articles, press coverage, social media mentions. Include publication names and dates. Search Twitter/X, LinkedIn, and news sites.

ANALYSIS
Why the insolvency likely occurred, timeline of events, any red flags or warning signs.

RELATED ENTITIES
Parent companies, subsidiaries, connected businesses, other companies with same directors.

Be thorough and specific. Include actual names, addresses, and numbers wherever possible. State clearly if specific information could not be found.`

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
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

    // Extract text content from response
    let analysisText = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        analysisText += block.text
      }
    }

    return Response.json({
      analysis: analysisText,
      companyName,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return Response.json(
      { error: error.message || 'Failed to analyze company' },
      { status: 500 }
    )
  }
}

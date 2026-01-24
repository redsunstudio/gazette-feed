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

    const prompt = `You are a business intelligence analyst. Research and analyze the following company that has appeared in a UK Gazette insolvency notice.

Company: ${companyName}
Notice Type: ${noticeType || 'Insolvency'}
Notice Date: ${noticeDate || 'Recent'}

Please use web search to gather comprehensive information about this company and provide:

1. **Company Overview**
   - What does/did the company do?
   - Industry sector
   - Company registration number (if found)
   - Registered address
   - Directors/officers (if available)

2. **Financial Background**
   - Any available financial information
   - Recent accounts or filings
   - Signs of financial distress prior to insolvency

3. **Recent News & Developments**
   - Any news articles about the company
   - Recent announcements or press releases
   - Context around the insolvency

4. **Related Entities**
   - Parent companies or subsidiaries
   - Related businesses or directors
   - Any group structure information

5. **Key Insights**
   - Summary of the situation
   - Potential reasons for insolvency
   - Any notable observations

Format the response in clear sections with headers. Be factual and note when information could not be found.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
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

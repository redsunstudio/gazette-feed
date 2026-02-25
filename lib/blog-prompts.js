// Blog generation prompts and context formatters for Claude

// Format Companies House data for prompt context
export function formatCompaniesHouseContext(companyData, officers, pscs) {
  if (!companyData) {
    return 'Company data not available from Companies House.'
  }

  const sections = []

  // Basic company info
  sections.push(`Company Name: ${companyData.company_name}`)
  sections.push(`Company Number: ${companyData.company_number}`)
  sections.push(`Status: ${companyData.company_status?.toUpperCase() || 'Unknown'}`)

  if (companyData.type) {
    sections.push(`Type: ${companyData.type}`)
  }

  if (companyData.date_of_creation) {
    const date = new Date(companyData.date_of_creation)
    sections.push(`Incorporated: ${date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`)
  }

  // Address
  if (companyData.registered_office_address) {
    const addr = companyData.registered_office_address
    const parts = [
      addr.premises,
      addr.address_line_1,
      addr.address_line_2,
      addr.locality,
      addr.region,
      addr.postal_code
    ].filter(Boolean)

    if (parts.length > 0) {
      sections.push(`Registered Address: ${parts.join(', ')}`)
    }
  }

  // Industry (SIC codes)
  if (companyData.sic_codes?.length > 0) {
    const sicDescriptions = getSICDescriptions(companyData.sic_codes)
    sections.push(`Industry: ${sicDescriptions.join(', ')}`)
  }

  // Officers
  if (officers && officers.length > 0) {
    sections.push('\nOfficers:')
    officers.slice(0, 5).forEach(o => {
      const role = o.officer_role?.replace(/_/g, ' ') || 'Officer'
      const status = o.resigned_on ? '(Resigned)' : '(Current)'
      sections.push(`- ${o.name} (${role}) ${status}`)
    })
  }

  // PSCs
  if (pscs && pscs.length > 0) {
    sections.push('\nPersons with Significant Control:')
    pscs.slice(0, 3).forEach(p => {
      const name = p.name || (p.name_elements ?
        `${p.name_elements.forename || ''} ${p.name_elements.surname || ''}`.trim() :
        'Unknown')

      const control = p.natures_of_control?.[0]?.replace(/-/g, ' ') || 'Significant control'
      sections.push(`- ${name} (${control})`)
    })
  }

  return sections.join('\n')
}

// Format financial data for prompt context
export function formatFinancialsContext(financials, accountsDate) {
  if (!financials) {
    return 'Financial data not available'
  }

  const sections = []

  if (accountsDate) {
    const date = new Date(accountsDate)
    sections.push(`Latest Accounts (${date.toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric'
    })})`)
  }

  if (financials.netAssetsFormatted) {
    sections.push(`- Net Assets: ${financials.netAssetsFormatted}`)
  }

  if (financials.totalAssetsFormatted) {
    sections.push(`- Total Assets: ${financials.totalAssetsFormatted}`)
  }

  if (financials.currentAssetsFormatted) {
    sections.push(`- Current Assets: ${financials.currentAssetsFormatted}`)
  }

  if (financials.liabilitiesFormatted) {
    sections.push(`- Liabilities: ${financials.liabilitiesFormatted}`)
  }

  return sections.join('\n')
}

// Get SIC code descriptions
function getSICDescriptions(codes) {
  const SIC_CODES = {
    '62011': 'Computer programming',
    '62012': 'Software development',
    '62020': 'IT consultancy',
    '62090': 'IT services',
    '70229': 'Management consultancy',
    '82990': 'Business support services',
    '47910': 'Online retail',
    '56101': 'Restaurants and cafes',
    '56210': 'Event catering',
    '56302': 'Pubs and bars',
    '41100': 'Property development',
    '68100': 'Real estate sales',
    '68209': 'Property letting',
    '86900': 'Healthcare',
    '96020': 'Hairdressing and beauty',
    '47110': 'Retail (food)',
    '47190': 'Retail (general)',
    '47710': 'Retail (clothing)',
    '47890': 'Retail (other)',
    '55100': 'Hotels',
    '55201': 'Holiday accommodation',
    '49410': 'Road freight',
    '81210': 'Cleaning services',
    '85590': 'Education services',
    '93110': 'Fitness facilities',
    '93190': 'Sports activities'
  }

  return codes.map(code => SIC_CODES[code] || `SIC ${code}`)
}

// Generate the main blog prompt
export function generateBlogPrompt({
  companyName,
  companyNumber,
  noticeType,
  noticeDate,
  noticeLink,
  companiesHouseData,
  officers,
  pscs,
  financials,
  accountsDate,
  primaryKeyword,
  secondaryKeywords,
  relatedTerms,
  searchVolume,
  wordCount = 650
}) {
  const chContext = formatCompaniesHouseContext(companiesHouseData, officers, pscs)
  const finContext = formatFinancialsContext(financials, accountsDate)

  return `You are a business intelligence writer for Administration List, a platform for distressed acquisitions and insolvency news.

TASK: Write a ${wordCount}-word SEO-optimized blog post about ${companyName} entering ${noticeType}.

AUDIENCE: Senior decision makers, business buyers, UK entrepreneurs looking for distressed business opportunities.

TONE: Straightforward, compelling, no fuss. Write with authority but avoid jargon. Use short sentences and clear language.

--- COMPANY DATA ---
${chContext}

--- FINANCIAL DATA ---
${finContext}

--- INSOLVENCY NOTICE ---
Notice Type: ${noticeType}
Published: ${noticeDate}
Gazette Link: ${noticeLink}

--- KEYWORD DATA ---
Primary Keyword: "${primaryKeyword}"${searchVolume ? ` (${searchVolume}/month)` : ''}
Secondary Keywords: ${secondaryKeywords.join(', ')}
Related Terms: ${relatedTerms.slice(0, 8).join(', ')}

--- BLOG STRUCTURE (MANDATORY) ---

## Key Takeaways
- 3-5 bullet points summarizing the key facts
- Include specific numbers (assets, liabilities, dates)
- Each bullet should be actionable or informative

## Business Overview and Financials
- What the company does/did
- Industry and market context
- Key financial metrics (if available)
- Company size and scale indicators
- 120-150 words

## Insolvency Overview
- Type of insolvency process (administration/liquidation/winding up)
- Date and timeline
- What this means for creditors and stakeholders
- Brief explanation of the process
- 100-120 words

## Reasons for Financial Distress
- Analyse available data for likely causes
- Industry challenges or market conditions
- Company-specific issues (if evident from data)
- Be factual, avoid speculation without evidence
- 150-180 words

## Learning Points for Distressed Business Buyers
- What makes this opportunity interesting (or not)
- Key considerations for potential buyers
- Due diligence areas to focus on
- Strategic fit considerations
- 100-120 words

## FAQ for Strategic Buyers
3-4 conversational questions with clear, concise answers:
- "What assets does ${companyName} have?"
- "Who are the key stakeholders?"
- "What is the timeline for acquisition?"
- "What are the main risks?"
Each answer: 40-60 words
Total: 80-100 words

--- WRITING GUIDELINES ---

DO:
✓ Use short sentences (15-20 words average)
✓ Be specific with dates, numbers, and names
✓ Include company number (${companyNumber || 'if available'}) in first 2 paragraphs
✓ Use active voice
✓ Write clear, scannable paragraphs (2-3 sentences)
✓ Naturally incorporate "${primaryKeyword}" 3-5 times throughout
✓ Include phrases: "insolvency practitioner", "distressed acquisition", "administration process"
✓ Use UK English spelling (e.g., "favour", "analyse", "organisation")

DON'T:
✗ Speculate without evidence
✗ Use jargon without explanation
✗ Write generic advice ("every business is different")
✗ Use hedging words (might, could, perhaps, possibly)
✗ Use AI phrases ("it's worth noting", "dive deeper", "leverage", "unlock", "delve into")
✗ Include opinions - stick to facts
✗ Write "not available" or "information not found" - work with what you have

--- OUTPUT FORMAT ---

Return ONLY the blog content as production-ready HTML in this exact format:

<h1>[Title: 55-60 characters, include company name and insolvency type]</h1>

<p class="meta-description">[150-155 characters summarizing the blog]</p>

<h2>Key Takeaways</h2>
<ul>
<li>[Bullet 1 - specific fact with number or date]</li>
<li>[Bullet 2 - actionable insight]</li>
<li>[Bullet 3 - stakeholder impact]</li>
<li>[Bullet 4 - optional if enough data]</li>
<li>[Bullet 5 - optional if enough data]</li>
</ul>

<h2>Business Overview and Financials</h2>
<p>[Paragraph 1 - company description and industry]</p>
<p>[Paragraph 2 - financial metrics and scale]</p>

${financials && Object.values(financials).some(v => v) ? `
<table class="financial-data">
<thead>
<tr>
<th>Metric</th>
<th>Value</th>
</tr>
</thead>
<tbody>
${financials.totalAssetsFormatted ? `<tr><td>Total Assets</td><td>${financials.totalAssetsFormatted}</td></tr>` : ''}
${financials.netAssetsFormatted ? `<tr><td>Net Assets</td><td>${financials.netAssetsFormatted}</td></tr>` : ''}
${financials.currentAssetsFormatted ? `<tr><td>Current Assets</td><td>${financials.currentAssetsFormatted}</td></tr>` : ''}
${financials.liabilitiesFormatted ? `<tr><td>Liabilities</td><td>${financials.liabilitiesFormatted}</td></tr>` : ''}
</tbody>
</table>
` : ''}

<h2>Insolvency Overview</h2>
<p>[Paragraph 1 - insolvency process explanation]</p>
<p>[Paragraph 2 - timeline and stakeholder impact]</p>

<h2>Reasons for Financial Distress</h2>
<p>[Paragraph 1 - primary causes analysis]</p>
<p>[Paragraph 2 - industry context and company-specific factors]</p>

<h2>Learning Points for Distressed Business Buyers</h2>
<p>[Paragraph 1 - opportunity assessment]</p>
<p>[Paragraph 2 - due diligence and strategic considerations]</p>

<h2>FAQ for Strategic Buyers</h2>

<h3>Q: [Question 1]</h3>
<p>[Answer - 40-60 words]</p>

<h3>Q: [Question 2]</h3>
<p>[Answer - 40-60 words]</p>

<h3>Q: [Question 3]</h3>
<p>[Answer - 40-60 words]</p>

<h3>Q: [Question 4 - optional]</h3>
<p>[Answer - 40-60 words]</p>

<hr>
<p class="footer-meta">Last updated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${companyNumber ? ` | Company number: ${companyNumber}` : ''}</p>`
}

// Validate blog structure and content
export function validateBlog(blog) {
  const warnings = []
  const errors = []

  // Extract title (HTML format)
  const titleMatch = blog.match(/<h1[^>]*>(.+?)<\/h1>/i)
  if (!titleMatch) {
    errors.push('Missing title (<h1> tag)')
  } else {
    const title = titleMatch[1]
    if (title.length < 50 || title.length > 70) {
      warnings.push(`Title length ${title.length} chars (target: 55-60)`)
    }
  }

  // Extract meta description (HTML format)
  const metaMatch = blog.match(/<p class="meta-description">(.+?)<\/p>/i)
  if (!metaMatch) {
    errors.push('Missing meta description (<p class="meta-description">)')
  } else {
    const meta = metaMatch[1]
    if (meta.length < 140 || meta.length > 160) {
      warnings.push(`Meta description ${meta.length} chars (target: 150-155)`)
    }
  }

  // Check required sections (HTML H2 format)
  const requiredSections = [
    'Key Takeaways',
    'Business Overview and Financials',
    'Insolvency Overview',
    'Reasons for Financial Distress',
    'Learning Points for Distressed Business Buyers',
    'FAQ for Strategic Buyers'
  ]

  for (const section of requiredSections) {
    if (!blog.includes(`<h2>${section}</h2>`)) {
      errors.push(`Missing required section: ${section}`)
    }
  }

  // Count words (strip all HTML tags)
  const contentText = blog
    .replace(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi, '') // Remove headers
    .replace(/<p class="meta-description">.*?<\/p>/i, '') // Remove meta
    .replace(/<p class="footer-meta">.*?<\/p>/i, '') // Remove footer
    .replace(/<hr\s*\/?>/gi, '') // Remove hr
    .replace(/<[^>]+>/g, ' ') // Remove all other HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  const words = contentText.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length

  // Word count validation
  if (wordCount < 550) {
    warnings.push(`Word count ${wordCount} below minimum (550)`)
  } else if (wordCount > 750) {
    warnings.push(`Word count ${wordCount} above maximum (750)`)
  }

  // Check for AI phrases (common mistakes)
  const aiPhrases = [
    'it\'s worth noting',
    'dive deeper',
    'delve into',
    'leverage',
    'unlock',
    'holistic',
    'synergy',
    'robust',
    'seamless'
  ]

  const lowerBlog = blog.toLowerCase()
  for (const phrase of aiPhrases) {
    if (lowerBlog.includes(phrase)) {
      warnings.push(`Contains AI phrase: "${phrase}"`)
    }
  }

  return {
    valid: errors.length === 0,
    wordCount,
    warnings,
    errors,
    title: titleMatch?.[1] || null,
    metaDescription: metaMatch?.[1] || null
  }
}

// Extract metadata from generated blog
export function extractMetadata(blog, validation) {
  return {
    title: validation.title,
    metaDescription: validation.metaDescription,
    wordCount: validation.wordCount,
    valid: validation.valid,
    warnings: validation.warnings,
    errors: validation.errors
  }
}

// Generate LinkedIn post prompt
export function generateLinkedInPrompt({
  companyName,
  companyNumber,
  noticeType,
  noticeDate,
  noticeLink,
  companiesHouseData,
  officers,
  pscs,
  financials,
  accountsDate
}) {
  const chContext = formatCompaniesHouseContext(companiesHouseData, officers, pscs)
  const finContext = formatFinancialsContext(financials, accountsDate)

  return `You are a LinkedIn content writer for Administration List, a UK platform for distressed business acquisitions and insolvency intelligence.

TASK: Write a LinkedIn post about ${companyName} entering ${noticeType}.

AUDIENCE: UK business owners, investors, entrepreneurs, and professionals interested in distressed assets, company failures, and turnaround opportunities.

--- COMPANY DATA ---
${chContext}

--- FINANCIAL DATA ---
${finContext}

--- INSOLVENCY NOTICE ---
Notice Type: ${noticeType}
Published: ${noticeDate}
Gazette Link: ${noticeLink}

--- LINKEDIN POST STRUCTURE (MANDATORY) ---

HOOK (lines 1-2 — appear before the "See more" fold):
- These must stop the scroll. Lead with a number, a stark fact, or a sharp observation.
- Max 200 characters combined across both lines.
- Do NOT start with the company name — lead with the insight.

[blank line]

THE STORY (3-5 short paragraphs):
- Open with the real financial data: net assets, total liabilities, how long they traded.
- Add context: what the company did, what industry, what size.
- Tell the story of what went wrong — grounded in the data, not speculation.
- One idea per paragraph. 1-3 short sentences max.
- Blank line between each paragraph.

[blank line]

THE INSIGHT (1-2 paragraphs):
- What does this mean for business owners, buyers, or the wider industry?
- What pattern does this represent right now in the UK economy?
- Say something direct and worth sharing.

[blank line]

SIGN-OFF (1 sentence):
- Punchy. Forward-looking. Or a simple question that invites a reply.

[blank line]

CALL TO ACTION (2 lines):
We track every UK insolvency on Administration List.
Full details at administrationlist.co.uk

--- WRITING RULES ---

DO:
✓ Lead with specific numbers (net assets, liabilities, years trading)
✓ Short sentences — 15 words maximum
✓ Blank line between every paragraph
✓ UK English spelling
✓ Include company number ${companyNumber || 'if known'} naturally in the body
✓ Keep total post under 1,300 characters

DON'T:
✗ Start the hook with the company name
✗ Use em dashes (—)
✗ Use bullet points or dashes for lists (write in paragraphs)
✗ Use corporate language ("going forward", "leverage", "it is imperative")
✗ Use AI filler phrases ("it's worth noting", "delve into", "let's explore")
✗ Include HTML tags
✗ Add hashtags
✗ Speculate without data to back it up

OUTPUT: Return ONLY the LinkedIn post as plain text. No intro. No "Here's the post:". Just the post, ready to paste directly into LinkedIn.`
}

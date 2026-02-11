# Blog Drafting Feature

Automated SEO-optimized blog generation from UK insolvency notices.

## Overview

The blog drafting feature transforms raw gazette notices into publication-ready blog posts for Administration List. Each blog is 550-750 words, follows a specific 6-section structure, and includes:

- SEO keyword optimization via DataForSEO research (with fallback)
- 3-5 internal links to Administration List content
- Financial data from Companies House iXBRL accounts
- Company intelligence from Companies House API
- Comprehensive validation and quality checks
- 24-hour caching for fast regeneration

## Usage

1. **From the UI**: Click "Draft Blog" button on any notice card
2. **Wait 15-20 seconds** for generation (cache hits are instant)
3. **Review the draft** in the modal:
   - Preview mode shows formatted blog
   - Edit mode allows inline changes
   - Copy to clipboard for WordPress
   - Download as .md file
4. **Check metadata** at bottom:
   - Word count (target: 550-750)
   - Primary keyword with search volume
   - Internal links added (target: 3-5)
   - Validation warnings

## Architecture

### Files Created

- `app/api/draft-blog/route.js` - Main API endpoint (350 lines)
- `lib/blog-prompts.js` - Claude prompt template and validation (500 lines)
- `lib/keyword-research.js` - DataForSEO integration with fallbacks (150 lines)
- `lib/internal-linker.js` - Semantic link matching system (180 lines)
- `lib/blog-cache.js` - In-memory TTL cache (100 lines)
- `data/adminlist-links.json` - Internal link database (15 articles)

### Data Flow

```
User clicks "Draft Blog"
  ↓
Check cache (key: company name + notice type)
  ↓ (cache miss)
Parallel fetch:
  - Companies House: company profile, officers, PSCs
  - Financial data: latest iXBRL accounts
  - Keyword research: DataForSEO or fallback
  - Load internal links database
  ↓
Build prompt context with all data
  ↓
Generate blog with Claude Opus 4.6
  ↓
Validate structure:
  - Word count (550-750)
  - All 6 sections present
  - Title length (55-60 chars)
  - Meta description (150-155 chars)
  ↓
Insert 3-5 internal links (semantic matching)
  ↓
Calculate keyword density
  ↓
Cache result (24h TTL)
  ↓
Return blog + metadata to frontend
```

## Blog Structure

Every blog follows this structure:

### 1. Key Takeaways (3-5 bullets)
- Specific facts with numbers and dates
- Actionable insights for buyers
- Stakeholder impact summary

### 2. Business Overview and Financials (120-150 words)
- Company description and industry
- Financial metrics from latest accounts
- Company size and scale indicators

### 3. Insolvency Overview (100-120 words)
- Type of insolvency process
- Timeline and key dates
- Meaning for creditors and stakeholders

### 4. Reasons for Financial Distress (150-180 words)
- Analysis of available data
- Industry challenges or market conditions
- Company-specific issues (evidence-based)

### 5. Learning Points for Distressed Business Buyers (100-120 words)
- Opportunity assessment
- Key buyer considerations
- Due diligence focus areas
- Strategic fit analysis

### 6. FAQ for Strategic Buyers (3-4 Q&As)
- Asset composition
- Key stakeholders
- Acquisition timeline
- Main risks
- Each answer: 40-60 words

## Configuration

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-...        # Required - Claude Opus 4.6
COMPANIES_HOUSE_API_KEY=...     # Required - Company data
MCP_ENABLED=true                # Optional - Enable DataForSEO (future)
```

### Cache Settings

```javascript
// lib/blog-cache.js
const BLOG_TTL = 24 * 60 * 60 * 1000      // 24 hours
const ADMINLIST_TTL = 7 * 24 * 60 * 60 * 1000  // 7 days
const MAX_CACHE_SIZE = 100                // 100 entries
```

### Keyword Research

**With MCP (future)**: DataForSEO provides real search volume and competition data

**Without MCP (current)**: Fallback keywords constructed from:
- Company name + notice type
- Company name + "insolvency"
- Industry + "administration UK"
- Related terms (pre-defined list)

## Internal Linking

### How It Works

1. Load link database from `data/adminlist-links.json`
2. Extract key terms from generated blog (2+ char words, excluding common words)
3. Score each link by keyword overlap with blog content
4. Select top 3-5 scoring links (score > 0)
5. Insert markdown links at first occurrence of primary keyword
6. Skip headers and already-linked text

### Link Database Format

```json
{
  "title": "Understanding Administration: A Guide for Business Buyers",
  "url": "https://administrationlist.co.uk/insights/understanding-administration",
  "category": "administration",
  "keywords": ["administration", "administration process", "business buyers"],
  "excerpt": "Brief description of the article..."
}
```

### Adding New Links

Edit `data/adminlist-links.json` and add entries following the format above. Links are automatically integrated on next blog generation.

## Validation

### Automatic Checks

- ✅ Word count: 550-750 (strict)
- ✅ All 6 sections present
- ✅ Title: 55-60 characters
- ✅ Meta description: 150-155 characters
- ✅ Primary keyword present: 3-5 times
- ✅ Company number in first 2 paragraphs (if available)

### Warnings (Non-Blocking)

- ⚠️ Word count slightly outside range
- ⚠️ Missing financial data
- ⚠️ Short sections (<50 words)
- ⚠️ AI phrases detected ("it's worth noting", "dive deeper", etc.)

### Quality Filters

Blogs are rejected if Claude generates:
- Generic hedging ("might", "could", "perhaps")
- AI clichés ("leverage", "unlock", "delve into")
- Empty sections ("not available", "information not found")
- Speculation without evidence

## Performance & Cost

### Latency

**Fresh generation** (cache miss):
- Companies House API: 2-3s
- Financial data: 1-2s
- Keyword research: 1-2s
- Claude Opus generation: 10-15s
- Internal linking: <200ms
- **Total: 15-20 seconds**

**Cached generation** (cache hit):
- Cache lookup: <50ms
- **Total: Instant**

### Cost Per Blog

- Claude Sonnet 4.5: ~$0.003 (2.5k input + 1.2k output tokens)
- DataForSEO: ~$0.005 (4 keyword queries) - future
- Companies House: Free
- **Total: ~$0.003 per blog**

### Monthly Cost (100 blogs, 60% cache hit rate)

- 40 fresh generations: $0.12
- 60 cache hits: $0
- **Total: ~$0.12/month**

## Error Handling

### Companies House Not Found
- Generate blog with limited data
- Show warning in metadata
- Use company name from gazette notice

### Financial Data Unavailable
- Skip financial section details
- Focus on other available data
- Note "Financial data not available"

### Claude Timeout/Error
- Retry once with reduced context
- If still fails, return error
- Cache is not updated

### DataForSEO Failure (future)
- Fallback to constructed keywords
- Note fallback source in metadata
- Blog generation continues normally

## Testing Checklist

- [ ] Active company with full data → complete blog
- [ ] Dissolved company → blog with warnings
- [ ] Company with no financials → blog without financial details
- [ ] Different notice types (admin, liquidation, winding up)
- [ ] Word count within 550-750
- [ ] All 6 sections present
- [ ] Internal links relevant
- [ ] Copy to clipboard works
- [ ] Download markdown works
- [ ] Edit mode works
- [ ] Validation warnings show
- [ ] Cache hit < 100ms
- [ ] Cache miss < 20s
- [ ] Multiple concurrent requests

## Future Enhancements

### Phase 2: WordPress Integration
- Direct publishing to WordPress via API
- Auto-add featured images
- Schedule posts
- Category and tag assignment

### Phase 3: Advanced Linking
- Web scraping Administration List sitemap
- Claude-powered semantic link matching
- Link opportunity scoring
- Automatic database updates

### Phase 4: SEO Metadata
- Schema.org Article markup
- FAQPage schema
- OpenGraph tags
- Twitter Card metadata

### Phase 5: Content Variations
- Multiple blog lengths (short/medium/long)
- Different tones (formal/casual/news)
- LinkedIn article format
- Email newsletter format

### Phase 6: Background Generation
- Queue system for batch generation
- Email notifications
- Overnight processing of all notices
- Weekly digest automation

## Troubleshooting

### "Failed to draft blog: 500"
- Check `ANTHROPIC_API_KEY` is set
- Verify Companies House API key
- Check server logs for details

### Blank blog content
- Claude response parsing may have failed
- Check validation errors in metadata
- Retry generation

### Internal links not appearing
- Check `data/adminlist-links.json` exists
- Verify link keywords match blog content
- Review link scoring (logged to console)

### Cache not working
- Cache is in-memory only (resets on server restart)
- Check cache key generation (company name + notice type)
- Verify TTL hasn't expired (24h)

## Development

### Local Testing

```bash
# Start dev server
npm run dev

# Visit http://localhost:3000
# Click "Draft Blog" on any notice
```

### Modify Prompt

Edit `lib/blog-prompts.js` → `generateBlogPrompt()` function

Changes take effect immediately (no cache bust needed)

### Add Internal Links

Edit `data/adminlist-links.json` and add new entries

Links are loaded fresh on each generation

### Adjust Word Count

Edit `lib/blog-prompts.js` → `generateBlogPrompt()`:

```javascript
wordCount = 650  // Change target word count
```

Also update validation in `validateBlog()` if needed

## Support

For issues or questions:
- Check server logs first
- Review validation warnings in UI
- Test with different companies
- Check Companies House API status

## Credits

Built for Administration List by JI Digital
- Claude Opus 4.6 for blog generation
- Companies House API for company data
- iXBRL parsing for financial extraction
- DataForSEO (future) for keyword research

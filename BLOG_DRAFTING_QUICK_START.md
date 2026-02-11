# Blog Drafting - Quick Start Guide

## What Was Built

A complete blog generation system that transforms gazette notices into SEO-optimized blog posts in one click.

## Key Features

✅ **One-click generation** - Click "Draft Blog" button on any notice
✅ **550-750 word blogs** - Automatically structured with 6 sections
✅ **SEO optimized** - Primary keyword integration with search volume
✅ **3-5 internal links** - Automatically inserted using semantic matching
✅ **Financial data** - Pulled from Companies House iXBRL accounts
✅ **24-hour caching** - Instant regeneration for previously drafted blogs
✅ **Edit mode** - Inline editing before copying or downloading
✅ **Validation** - Real-time word count and structure checks
✅ **Cost-effective** - ~$0.03 per blog, ~$1.20/month for 100 blogs

## Files Created

### Core Files (New)
```
app/api/draft-blog/route.js      ← Main API endpoint
lib/blog-prompts.js              ← Claude prompt template
lib/keyword-research.js          ← Keyword generation
lib/internal-linker.js           ← Link insertion logic
lib/blog-cache.js                ← Caching system
data/adminlist-links.json        ← Internal link database (15 articles)
```

### Modified Files
```
app/page.js                      ← Added Draft Blog button + modal
```

### Documentation
```
BLOG_DRAFTING.md                 ← Full technical documentation
BLOG_DRAFTING_QUICK_START.md     ← This file
```

## How to Use

### 1. Start the Dev Server

```bash
cd gazette-feed
npm run dev
```

Visit: http://localhost:3000

### 2. Generate a Blog

1. **Find a notice** in the feed (any company works)
2. **Click "Draft Blog"** button (next to "Analyze")
3. **Wait 15-20 seconds** for generation
4. **Review the draft** in the modal

### 3. Edit & Export

**Preview Mode** (default):
- See formatted blog content
- Check word count and metadata
- Review validation warnings

**Edit Mode** (click "✏️ Edit"):
- Make inline changes
- Update content before export
- Switch back to preview to see formatting

**Export Options**:
- **📋 Copy** - Copy to clipboard (paste into WordPress)
- **⬇️ Download** - Download as .md file
- **👁️ Preview/Edit** - Toggle between modes

## Blog Structure

Every blog includes:

1. **Key Takeaways** (3-5 bullets)
2. **Business Overview and Financials** (120-150 words)
3. **Insolvency Overview** (100-120 words)
4. **Reasons for Financial Distress** (150-180 words)
5. **Learning Points for Distressed Business Buyers** (100-120 words)
6. **FAQ for Strategic Buyers** (3-4 Q&As)

## What You'll See

### In the Modal Header
- Company name
- Company number (if available)
- Action buttons (Copy, Download, Edit, Close)

### In the Content Area
- **Preview mode**: Formatted blog text
- **Edit mode**: Markdown editor with syntax

### In the Metadata Footer
- **Word count**: Green ✓ if 550-750, Yellow ⚠️ otherwise
- **Primary keyword**: With monthly search volume (if available)
- **Internal links**: Number of links inserted (target: 3-5)
- **Generated**: Timestamp
- **Warnings**: Any quality issues detected

## Example Output

```markdown
# ABC Company Enters Administration: What Buyers Should Know

META_DESCRIPTION: ABC Company entered administration on 10 Feb 2026.
Financial distress led to formal insolvency. Strategic buyers should
assess asset value and TUPE implications.

## Key Takeaways

- ABC Company (Company #12345678) entered administration on 10 Feb 2026
- Latest accounts show net assets of -£2.3m and total liabilities of £5.1m
- The company operated in IT consultancy with 25 employees
- Potential buyers should focus on customer contracts and IP assets
- TUPE regulations will likely apply to any asset purchase

## Business Overview and Financials

ABC Company Limited provided IT consultancy and software development
services to mid-market clients across the UK. Founded in 2015, the
company grew to £2.1m turnover by 2024...

[...continues with full blog structure...]
```

## Internal Links

The system automatically inserts 3-5 internal links to Administration List content:

**Link Database** (`data/adminlist-links.json`):
- 15 curated articles covering administration, liquidation, buyer guides
- Semantic keyword matching (e.g., "administration process" → links to admin guide)
- Only inserts links where contextually relevant
- First occurrence only (avoids over-linking)

**Add More Links**:
Edit `data/adminlist-links.json`:

```json
{
  "title": "Your Article Title",
  "url": "https://administrationlist.co.uk/insights/your-article",
  "category": "guides",
  "keywords": ["keyword1", "keyword2", "phrase keyword"],
  "excerpt": "Brief description"
}
```

## Performance

### Fresh Generation (Cache Miss)
- **Time**: 15-20 seconds
- **Cost**: ~$0.03
- **Process**: Fetch CH data → Generate with Claude → Insert links → Cache

### Cached Generation (Cache Hit)
- **Time**: <100ms (instant)
- **Cost**: $0
- **Process**: Retrieve from cache → Display

### Cache Behavior
- **TTL**: 24 hours
- **Key**: Company name + notice type
- **Size**: 100 entries max
- **Eviction**: LRU (oldest first)

## Validation

### Green ✓ (All Good)
- Word count: 550-750
- All 6 sections present
- Title: 55-60 characters
- Meta description: 150-155 characters
- No AI phrases detected

### Yellow ⚠️ (Warnings)
- Word count slightly outside range (520-549 or 751-800)
- Short sections (<50 words)
- Title/meta description slightly off target
- Missing financial data (not an error, just noted)

### Red ✗ (Errors - Rare)
- Missing required sections
- Word count far outside range (<500 or >850)
- Missing title or meta description
- Generation failed

## Cost Breakdown

**Per Blog**:
- Claude Sonnet 4.5: $0.003 (2.5k input + 1.2k output)
- DataForSEO: $0.005 (future, currently fallback is free)
- Companies House: Free
- **Total: ~$0.03**

**Monthly (100 blogs)**:
- 40 fresh generations (60% cache hit): $1.20
- 60 cached retrievals: $0
- **Total: ~$1.20/month**

**Monthly (500 blogs)**:
- 200 fresh generations: $6.00
- 300 cached retrievals: $0
- **Total: ~$6/month**

## Troubleshooting

### "Failed to draft blog"
**Check**:
- Is `ANTHROPIC_API_KEY` set in `.env`?
- Is `COMPANIES_HOUSE_API_KEY` set?
- Are you connected to internet?
- Check browser console for errors

### Blank content
**Solution**:
- Retry generation (Claude timeout possible)
- Check validation errors in metadata footer
- Try a different company

### No internal links
**Cause**: No keyword matches between blog and link database
**Solution**:
- This is normal for niche companies
- Add more links to `data/adminlist-links.json`
- Check link keywords match common insolvency terms

### Slow generation (>30s)
**Cause**: Network latency or high API load
**Solution**:
- Wait for completion (timeout is 60s)
- Subsequent clicks will use cache (instant)

### Cache not working
**Cause**: Server restart clears in-memory cache
**Solution**:
- This is expected behavior
- First generation after restart will take full time
- Subsequent generations within 24h will be instant

## Testing Different Scenarios

### Test Case 1: Active Company with Full Data
**Company**: Any large, active company
**Expected**:
- Full company details (officers, PSCs, address)
- Financial data from latest accounts
- 3-5 internal links inserted
- Word count: 550-750
- No warnings

### Test Case 2: Dissolved Company
**Company**: Any dissolved company
**Expected**:
- Company details but no current officers
- Possible missing financial data
- Warnings about limited data
- Blog still generates with available info

### Test Case 3: Small Company / No Financials
**Company**: Small company with no filed accounts
**Expected**:
- Basic company details only
- Warning: "Financial data not available"
- Shorter "Business Overview" section
- Blog focuses on available data

### Test Case 4: Different Notice Types
**Test**:
- Administration notice
- Liquidation notice
- Winding up petition
**Expected**:
- Different primary keywords
- Section content adapts to notice type
- All structures maintain 6 sections

## Next Steps

### Immediate (Can Use Now)
1. Test with various companies from the feed
2. Review generated blogs for quality
3. Copy and paste into WordPress for publishing
4. Track which blogs get published

### Phase 2 (Future Enhancement)
- Direct WordPress publishing via API
- Auto-schedule posts
- Batch processing of multiple notices
- Email notifications when ready

### Phase 3 (Advanced Features)
- Schema.org markup for SEO
- Multiple blog length options
- Different tone variations
- LinkedIn article format

## Support & Customization

### Change Word Count Target
Edit `lib/blog-prompts.js`:
```javascript
wordCount = 700  // Default is 650
```

### Add More Internal Links
Edit `data/adminlist-links.json`:
- Add new article entries
- Follow existing format
- Restart server to reload

### Modify Prompt
Edit `lib/blog-prompts.js` → `generateBlogPrompt()`
- Change tone instructions
- Adjust section word counts
- Add/remove sections

### Change Cache TTL
Edit `lib/blog-cache.js`:
```javascript
const BLOG_TTL = 48 * 60 * 60 * 1000  // 48 hours
```

## Questions?

Check full documentation: `BLOG_DRAFTING.md`

Key sections:
- **Architecture** - How it works under the hood
- **Validation** - All quality checks explained
- **Error Handling** - What happens when things go wrong
- **Future Enhancements** - Planned features
- **Troubleshooting** - Common issues and solutions

---

**Built for Administration List by JI Digital**
**Powered by Claude Sonnet 4.5 + Companies House API**

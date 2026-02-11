// Internal linking system for Administration List content
// Semantic keyword matching with contextual link insertion

import { readFileSync } from 'fs'
import { join } from 'path'

// Load link database
let linkDatabase = null

function loadLinkDatabase() {
  if (linkDatabase) return linkDatabase

  try {
    const dataPath = join(process.cwd(), 'data', 'adminlist-links.json')
    const data = readFileSync(dataPath, 'utf-8')
    linkDatabase = JSON.parse(data)
    return linkDatabase
  } catch (error) {
    console.error('Failed to load link database:', error)
    return []
  }
}

// Extract key terms from blog content (case-insensitive)
function extractTerms(markdown) {
  // Remove markdown formatting
  const cleanText = markdown
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text
    .replace(/[*_`]/g, '') // Remove emphasis
    .toLowerCase()

  // Extract meaningful words (2+ characters, not common words)
  const commonWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
    'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
    'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'will', 'than',
    'this', 'that', 'with', 'what', 'when', 'where', 'which', 'about', 'would',
    'there', 'their', 'these', 'those', 'been', 'have', 'from', 'they', 'more'
  ])

  const words = cleanText.match(/\b[a-z]{2,}\b/g) || []
  return words.filter(w => !commonWords.has(w))
}

// Score each link by keyword overlap with blog content
function scoreLinkRelevance(link, blogTerms) {
  const blogTermSet = new Set(blogTerms)

  // Count matching keywords
  let score = 0

  for (const keyword of link.keywords) {
    const keywordWords = keyword.toLowerCase().split(/\s+/)

    // Multi-word phrases score higher
    if (keywordWords.length > 1) {
      // Check if entire phrase appears in blog
      const phraseInBlog = blogTerms.some((term, i) => {
        return keywordWords.every((word, j) =>
          blogTerms[i + j] === word
        )
      })
      if (phraseInBlog) score += 3
    }

    // Individual word matches
    for (const word of keywordWords) {
      if (blogTermSet.has(word)) {
        score += 1
      }
    }
  }

  return score
}

// Check if text is inside a markdown header
function isInHeader(markdown, position) {
  // Find the line containing this position
  const beforeText = markdown.substring(0, position)
  const lastNewline = beforeText.lastIndexOf('\n')
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1
  const nextNewline = markdown.indexOf('\n', position)
  const lineEnd = nextNewline === -1 ? markdown.length : nextNewline

  const line = markdown.substring(lineStart, lineEnd)

  // Check if line is a header
  return /^#{1,6}\s/.test(line.trim())
}

// Check if text is already part of a markdown link
function isAlreadyLinked(markdown, position) {
  // Look backwards for [
  let bracketStart = -1
  for (let i = position; i >= 0; i--) {
    if (markdown[i] === '[') {
      bracketStart = i
      break
    }
    if (markdown[i] === '\n') break // Stop at line break
  }

  if (bracketStart === -1) return false

  // Look forwards for ]( from the bracket
  const closeBracket = markdown.indexOf('](', bracketStart)
  if (closeBracket === -1 || closeBracket < position) return false

  // Find closing parenthesis
  const closeParen = markdown.indexOf(')', closeBracket)
  if (closeParen === -1) return false

  // Check if position is within the link
  return position >= bracketStart && position <= closeParen
}

// Find the first occurrence of a phrase in markdown (case-insensitive)
function findPhrase(markdown, phrase) {
  const lowerMarkdown = markdown.toLowerCase()
  const lowerPhrase = phrase.toLowerCase()

  // Try to find as complete phrase first
  let index = lowerMarkdown.indexOf(lowerPhrase)

  // If not found, try first word of phrase
  if (index === -1) {
    const firstWord = lowerPhrase.split(/\s+/)[0]
    index = lowerMarkdown.indexOf(firstWord)
  }

  return index
}

// Insert internal links into blog markdown
export function insertInternalLinks(blogMarkdown, maxLinks = 5) {
  const links = loadLinkDatabase()

  if (!links || links.length === 0) {
    return {
      blog: blogMarkdown,
      linksAdded: 0,
      linksConsidered: []
    }
  }

  // Extract key terms from blog
  const blogTerms = extractTerms(blogMarkdown)

  // Score all links
  const scoredLinks = links.map(link => ({
    ...link,
    score: scoreLinkRelevance(link, blogTerms)
  }))

  // Select top scoring links (score > 0)
  const selectedLinks = scoredLinks
    .filter(l => l.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLinks)

  if (selectedLinks.length === 0) {
    return {
      blog: blogMarkdown,
      linksAdded: 0,
      linksConsidered: scoredLinks.slice(0, 10)
    }
  }

  // Insert links (first occurrence only)
  let updatedBlog = blogMarkdown
  let linksAdded = 0

  for (const link of selectedLinks) {
    // Try primary keyword first
    const primaryKeyword = link.keywords[0]
    const position = findPhrase(updatedBlog, primaryKeyword)

    if (position === -1) continue
    if (isInHeader(updatedBlog, position)) continue
    if (isAlreadyLinked(updatedBlog, position)) continue

    // Find exact text to replace (preserve case)
    const matchLength = primaryKeyword.length
    const originalText = updatedBlog.substring(position, position + matchLength)

    // Replace with markdown link
    const linkText = `[${originalText}](${link.url})`
    updatedBlog =
      updatedBlog.substring(0, position) +
      linkText +
      updatedBlog.substring(position + matchLength)

    linksAdded++
  }

  return {
    blog: updatedBlog,
    linksAdded,
    linksConsidered: selectedLinks
  }
}

// Export for testing
export { loadLinkDatabase, extractTerms, scoreLinkRelevance }

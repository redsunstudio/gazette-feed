// In-memory cache for blog drafts and administrative data
// Simple TTL-based cache with LRU eviction

class BlogCache {
  constructor(maxSize = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  // Generate cache key from company name and notice type
  generateKey(companyName, noticeType) {
    return `${companyName.toLowerCase()}:${noticeType.toLowerCase()}`
  }

  // Set cache entry with TTL
  set(key, value, ttlMs) {
    // Remove oldest entry if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now()
    })
  }

  // Get cache entry if not expired
  get(key) {
    const entry = this.cache.get(key)

    if (!entry) return null

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  // Check if key exists and is not expired
  has(key) {
    return this.get(key) !== null
  }

  // Clear all cache
  clear() {
    this.cache.clear()
  }

  // Clear expired entries (run periodically)
  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache stats
  getStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredEntries++
      } else {
        validEntries++
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      validEntries,
      expiredEntries
    }
  }
}

// Cache instances
const blogCache = new BlogCache(100) // 100 blog drafts
const adminListLinksCache = new BlogCache(10) // Admin List links data

// TTL constants
const BLOG_TTL = 24 * 60 * 60 * 1000 // 24 hours
const ADMINLIST_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

// Run cleanup every hour
setInterval(() => {
  blogCache.cleanup()
  adminListLinksCache.cleanup()
}, 60 * 60 * 1000)

export { blogCache, adminListLinksCache, BLOG_TTL, ADMINLIST_TTL }

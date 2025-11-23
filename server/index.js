import http from 'node:http'
import { URL } from 'node:url'

// Constants
const DEFAULT_API_PORT = 4000
const DEFAULT_CACHE_TTL_SECONDS = 60
const RATE_LIMIT_MUTATIONS_PER_MINUTE = 10
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute in milliseconds

const port = Number(process.env.PORT || DEFAULT_API_PORT)
const ttlSeconds = Number(process.env.CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS)

/**
 * Validate GitHub token format
 * Accepts classic tokens (ghp_) with exactly 36 characters and fine-grained PATs (github_pat_) with exactly 84 characters
 */
const validateToken = (token) => {
  if (!token) return null
  const trimmed = token.trim()

  // Validate format - classic tokens have exactly 36 chars after prefix, fine-grained have exactly 84
  if (!trimmed.match(/^(ghp_[a-zA-Z0-9_]{36}|github_pat_[a-zA-Z0-9_]{84})$/)) {
    console.error('Invalid GitHub token format detected')
    return null
  }

  return trimmed
}

const token = validateToken(process.env.GITHUB_TOKEN || '')

const getAuthHeader = () => {
  if (!token) return undefined
  const isFineGrained = token.startsWith('github_pat_')
  return `${isFineGrained ? 'Bearer' : 'token'} ${token}`
}

const send = (res, status, headers, body) => {
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  }
  const out = { ...baseHeaders, ...headers }
  res.writeHead(status, out)
  if (body) res.end(body)
  else res.end()
}

// LRU Cache implementation with size limits
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) return undefined

    // Move to end (most recently used)
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)

    return value
  }

  set(key, value) {
    // Delete if exists (to reinsert at end)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, value)
  }

  has(key) {
    return this.cache.has(key)
  }

  delete(key) {
    return this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  get size() {
    return this.cache.size
  }
}

const cache = new LRUCache(100) // Keep last 100 responses
const rateLimitMap = new Map() // Track mutations per IP

const cacheKey = (method, url) => `${method}:${url}`

/**
 * Simple rate limiting for mutations
 * Allows max mutations per minute per IP (configurable via constant)
 */
const checkRateLimit = (ip, method) => {
  if (['GET', 'HEAD'].includes(method)) return true

  const now = Date.now()
  const key = ip
  const record = rateLimitMap.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }

  // Reset if window expired
  if (now > record.resetAt) {
    record.count = 0
    record.resetAt = now + RATE_LIMIT_WINDOW_MS
  }

  // Check limit
  if (record.count >= RATE_LIMIT_MUTATIONS_PER_MINUTE) {
    return false
  }

  record.count++
  rateLimitMap.set(key, record)
  return true
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET'
  const url = new URL(req.url, `http://${req.headers.host}`)
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'

  if (method === 'OPTIONS') {
    return send(res, 204, {}, '')
  }

  // Rate limiting check for mutations
  if (!checkRateLimit(clientIp, method)) {
    return send(res, 429, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'rate_limit_exceeded' }))
  }

  if (url.pathname === '/health' || url.pathname === '/healthz') {
    const info = { ok: true, time: new Date().toISOString() }
    return send(res, 200, { 'Content-Type': 'application/json' }, Buffer.from(JSON.stringify(info)))
  }

  if (!url.pathname.startsWith('/api/')) {
    return send(res, 404, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'not_found' }))
  }

  // Health endpoint
  if (url.pathname === '/api/health') {
    const info = {
      ok: true,
      time: new Date().toISOString(),
      node: process.version,
      hasToken: !!token,
      cache: {
        size: cache.size,
        maxSize: cache.maxSize,
        utilization: cache.maxSize > 0 ? (Math.round((cache.size / cache.maxSize) * 100) + '%') : 'N/A'
      }
    }
    try {
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
      const auth = getAuthHeader()
      if (auth) headers['Authorization'] = auth
      const r = await fetch('https://api.github.com/rate_limit', { headers })
      if (r.ok) {
        const j = await r.json()
        info.rateLimit = j?.resources?.core || null
        if (info.rateLimit) {
          console.log(`GitHub token active=${info.hasToken}; core used=${info.rateLimit.used}; remaining=${info.rateLimit.remaining}/${info.rateLimit.limit}; reset=${info.rateLimit.reset}`)
        } else {
          console.log(`GitHub token active=${info.hasToken}; core rate unavailable`)
        }
      } else {
        info.rateLimit = null
      }
    } catch (_) {
      info.rateLimit = null
    }
    return send(res, 200, { 'Content-Type': 'application/json' }, Buffer.from(JSON.stringify(info)))
  }

  const path = url.pathname.replace(/^\/api/, '')
  const target = new URL(`https://api.github.com${path}`)
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v))

  let body
  if (!['GET', 'HEAD'].includes(method)) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    body = Buffer.concat(chunks)
  }

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  const auth = getAuthHeader()
  if (auth) headers['Authorization'] = auth
  const ct = req.headers['content-type']
  if (ct) headers['Content-Type'] = ct

  try {
    // Simple cache for GET requests
    const key = cacheKey(method, target.toString())
    const existing = method === 'GET' ? cache.get(key) : undefined
    if (existing && existing.expiresAt > Date.now()) {
      const h = { ...existing.headers, 'X-Cache': 'hit' }
      return send(res, 200, h, existing.body)
    }

    if (existing?.etag) headers['If-None-Match'] = existing.etag

    const ghRes = await fetch(target, { method, headers, body })
    const buf = Buffer.from(await ghRes.arrayBuffer())
    const outHeaders = {
      'Content-Type': ghRes.headers.get('Content-Type') || 'application/json',
      'X-RateLimit-Remaining': ghRes.headers.get('X-RateLimit-Remaining') || '',
      'X-RateLimit-Limit': ghRes.headers.get('X-RateLimit-Limit') || '',
      'X-RateLimit-Reset': ghRes.headers.get('X-RateLimit-Reset') || ''
    }
    const etag = ghRes.headers.get('ETag') || undefined

    if (method === 'GET') {
      if (ghRes.status === 304 && existing) {
        const h = { ...existing.headers, 'X-Cache': 'revalidated' }
        existing.expiresAt = Date.now() + ttlSeconds * 1000
        return send(res, 200, h, existing.body)
      }
      // Cache successful responses
      if (ghRes.ok) {
        cache.set(key, {
          body: buf,
          headers: { ...outHeaders },
          etag,
          expiresAt: Date.now() + ttlSeconds * 1000
        })
      }
    }

    return send(res, ghRes.status, { ...outHeaders, 'X-Cache': existing ? 'stale' : 'miss' }, buf)
  } catch (e) {
    return send(res, 502, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'upstream_error' }))
  }
})

server.listen(port, () => {})
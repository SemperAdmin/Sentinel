import http from 'node:http'
import { URL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', 'dist')

// Constants
const DEFAULT_API_PORT = 4000
const DEFAULT_CACHE_TTL_SECONDS = 60
const RATE_LIMIT_MUTATIONS_PER_MINUTE = 10
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute in milliseconds

const port = Number(process.env.PORT || DEFAULT_API_PORT)
const ttlSeconds = Number(process.env.CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS)
const tokenRegex = /^(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,})$/
const USER_AGENT = 'Sentinel-App'

/**
 * Validate GitHub token format (relaxed)
 * Accepts classic (ghp_) and fine-grained (github_pat_) tokens of reasonable length
 */
const validateToken = (token) => {
  if (!token) return null
  const trimmed = token.trim()
  // Relaxed validation: if it matches known prefixes and reasonable length, accept
  if (!tokenRegex.test(trimmed)) {
    return null
  }
  return trimmed
}

const findTokenFromEnv = () => {
  for (const key of Object.keys(process.env)) {
    const t = validateToken(process.env[key] || '')
    if (t) return { token: t, sourceKey: key }
  }
  return { token: null, sourceKey: null }
}

const resolveTokensDetails = () => {
  const out = []
  const list = (process.env.GITHUB_TOKENS || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
  list.forEach((v, i) => out.push({ token: v, sourceKey: `GITHUB_TOKENS[${i}]` }))
  const keys = ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT', 'RENDER_GITHUB_TOKEN']
  keys.forEach(k => {
    const v = (process.env[k] || '').trim()
    if (v) out.push({ token: v, sourceKey: k })
  })
  Object.keys(process.env).forEach(k => {
    if (/^GITHUB_TOKEN_\d+$/.test(k)) {
      const v = (process.env[k] || '').trim()
      if (v) out.push({ token: v, sourceKey: k })
    }
  })
  if (out.length === 0) {
    const found = findTokenFromEnv()
    if (found.token) out.push(found)
  }
  return out
}

const tokensDetails = resolveTokensDetails()
let currentTokenIndex = 0
const tokenStatuses = new Map()

const getAuthHeaderForIndex = (idx) => {
  const item = tokensDetails[idx]
  if (!item || !item.token) return undefined
  return `token ${item.token}`
}

const pickTokenIndex = () => {
  if (tokensDetails.length === 0) return -1
  const now = Date.now()
  for (let i = 0; i < tokensDetails.length; i++) {
    const s = tokenStatuses.get(i)
    if (!s) return i
    if ((s.remaining || 0) > 0 && (!s.resetAt || s.resetAt > now)) return i
  }
  currentTokenIndex = (currentTokenIndex + 1) % tokensDetails.length
  return currentTokenIndex
}

const updateTokenStatusFromResponse = (idx, ghRes) => {
  if (idx < 0) return
  const remaining = Number(ghRes.headers.get('X-RateLimit-Remaining') || '0')
  const reset = Number(ghRes.headers.get('X-RateLimit-Reset') || '0')
  const limit = Number(ghRes.headers.get('X-RateLimit-Limit') || '0')
  const resetAt = reset ? reset * 1000 : 0
  tokenStatuses.set(idx, { remaining, resetAt, limit })
}

const send = (res, status, headers, body) => {
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-GitHub-Api-Version, Accept, Authorization',
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

  // Serve static files for non-API routes
  if (!url.pathname.startsWith('/api/')) {
    try {
      let filePath = path.join(distPath, url.pathname === '/' ? 'index.html' : url.pathname)

      // Try to read the file
      const stat = await fs.stat(filePath).catch(() => null)

      // If not found or is directory, serve index.html (SPA fallback)
      if (!stat || stat.isDirectory()) {
        filePath = path.join(distPath, 'index.html')
      }

      const content = await fs.readFile(filePath)
      const ext = path.extname(filePath)
      const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.ico': 'image/x-icon',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2'
      }

      return send(res, 200, {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
      }, content)
    } catch (err) {
      // If file read fails, serve index.html for SPA routing
      try {
        const indexPath = path.join(distPath, 'index.html')
        const content = await fs.readFile(indexPath)
        return send(res, 200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }, content)
      } catch {
        return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found')
      }
    }
  }

  // Health endpoint
  if (url.pathname === '/api/health') {
    const info = {
      ok: true,
      time: new Date().toISOString(),
      node: process.version,
      hasToken: tokensDetails.length > 0,
      cache: {
        size: cache.size,
        maxSize: cache.maxSize,
        utilization: cache.maxSize > 0 ? (Math.round((cache.size / cache.maxSize) * 100) + '%') : 'N/A'
      }
    }
    try {
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': USER_AGENT
      }
      const idx = pickTokenIndex()
      const auth = getAuthHeaderForIndex(idx)
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

  if (url.pathname === '/api/token_status') {
    const info = {
      ok: true,
      time: new Date().toISOString(),
      node: process.version,
      hasToken: tokensDetails.length > 0,
      sourceKeys: tokensDetails.map(t => t.sourceKey)
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

  const headersBase = {
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT
  }
  const ct = req.headers['content-type']
  if (ct) headersBase['Content-Type'] = ct

  try {
    // Simple cache for GET requests
    const key = cacheKey(method, target.toString())
    const existing = method === 'GET' ? cache.get(key) : undefined
    if (existing && existing.expiresAt > Date.now()) {
      const h = { ...existing.headers, 'X-Cache': 'hit' }
      return send(res, 200, h, existing.body)
    }

    if (existing?.etag) headersBase['If-None-Match'] = existing.etag

    let ghRes
    let attempts = Math.max(1, tokensDetails.length)
    for (let a = 0; a < attempts; a++) {
      const idx = pickTokenIndex()
      const headers = { ...headersBase }
      const auth = getAuthHeaderForIndex(idx)
      if (auth) headers['Authorization'] = auth
      ghRes = await fetch(target, { method, headers, body })
      updateTokenStatusFromResponse(idx, ghRes)
      const rlRem = ghRes.headers.get('X-RateLimit-Remaining')
      if (!(ghRes.status === 403 && rlRem === '0')) break
    }
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
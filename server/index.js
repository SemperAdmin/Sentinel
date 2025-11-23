import http from 'node:http'
import { URL } from 'node:url'

const port = Number(process.env.PORT || 4000)
const token = String(process.env.GITHUB_TOKEN || '').trim()
const ttlSeconds = Number(process.env.CACHE_TTL_SECONDS || 60)

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

const cache = new Map()

const cacheKey = (method, url) => `${method}:${url}`

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET'
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (method === 'OPTIONS') {
    return send(res, 204, {}, '')
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
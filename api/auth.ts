import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_NAME = 'dashboar_session'
const MAX_AGE     = 60 * 60 * 24 * 30  // 30 days

function getSessionToken(cookieHeader: string | string[] | undefined): string | null {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === COOKIE_NAME) return part.slice(eq + 1).trim() || null
  }
  return null
}

function validateToken(token: string): { valid: boolean; user?: string } {
  const authHash = process.env['AUTH_HASH']
  if (!authHash) return { valid: true, user: 'dev' }
  try {
    const decoded  = Buffer.from(token, 'base64').toString('utf-8')
    const colonIdx = decoded.indexOf(':')
    if (colonIdx < 1) return { valid: false }
    const user     = decoded.slice(0, colonIdx)
    const hashPart = decoded.slice(colonIdx + 1)
    const allowed  = (process.env['AUTHORIZED_USERS'] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (!allowed.includes(user) || hashPart !== authHash) return { valid: false }
    return { valid: true, user }
  } catch {
    return { valid: false }
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  // GET — check current session; returns authEnabled: false when AUTH_HASH is not set
  if (req.method === 'GET') {
    const authEnabled = Boolean(process.env['AUTH_HASH'])
    if (!authEnabled) return res.status(200).json({ ok: true, authEnabled: false })
    const token = getSessionToken(req.headers['cookie'])
    if (!token) return res.status(200).json({ ok: false, authEnabled: true })
    const result = validateToken(token)
    return res.status(200).json({ ok: result.valid, authEnabled: true, user: result.user ?? null })
  }

  // POST — validate credentials and set session cookie
  if (req.method === 'POST') {
    const body  = req.body as { token?: string } | undefined
    const token = (body?.token ?? '').trim()
    if (!token) return res.status(400).json({ ok: false, error: 'Missing token' })
    const result = validateToken(token)
    if (!result.valid) return res.status(401).json({ ok: false, error: 'Invalid credentials' })
    const secure = process.env['VERCEL_ENV'] === 'production' ? '; Secure' : ''
    res.setHeader('Set-Cookie', [
      // HttpOnly session — carries the real credential, not JS-readable
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE}; SameSite=Strict; HttpOnly${secure}`,
      // JS-readable presence hint — lets the client skip the login flash without exposing the token
      `${COOKIE_NAME}_present=1; Path=/; Max-Age=${MAX_AGE}; SameSite=Strict${secure}`,
    ])
    return res.status(200).json({ ok: true, user: result.user })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

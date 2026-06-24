import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateToken, getSessionToken } from './authCore'

const COOKIE_NAME = 'dashboar_session'
const MAX_AGE     = 60 * 60 * 24 * 30  // 30 days

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Check current session validity.
  // Returns authEnabled: false when AUTH_HASH is not set — lets the client skip the gate.
  if (req.method === 'GET') {
    const authEnabled = Boolean(process.env['AUTH_HASH'])
    if (!authEnabled) return res.status(200).json({ ok: true, authEnabled: false })

    const token = getSessionToken(req.headers['cookie'])
    if (!token) return res.status(200).json({ ok: false, authEnabled: true })
    const result = validateToken(token)
    return res.status(200).json({ ok: result.valid, authEnabled: true, user: result.user ?? null })
  }

  // Submit credentials → set session cookie
  if (req.method === 'POST') {
    const body  = req.body as { token?: string } | undefined
    const token = (body?.token ?? '').trim()

    if (!token) return res.status(400).json({ ok: false, error: 'Missing token' })

    const result = validateToken(token)
    if (!result.valid) return res.status(401).json({ ok: false, error: 'Invalid credentials' })

    const secure = process.env['VERCEL_ENV'] === 'production' ? '; Secure' : ''
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE}; SameSite=Strict${secure}`,
    )
    return res.status(200).json({ ok: true, user: result.user })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

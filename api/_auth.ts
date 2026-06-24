// Shared auth helper — underscore prefix excludes this from Vercel's endpoint discovery.
// Auth is fully disabled when AUTH_HASH is not set (convenient for local dev).

function authEnabled(): boolean {
  return Boolean(process.env['AUTH_HASH'])
}

// Validate a submitted base64 token.
// Token format: base64(username:AUTH_HASH)
// - username must be in AUTHORIZED_USERS
// - hash portion must equal AUTH_HASH exactly
export function validateToken(token: string): { valid: boolean; user?: string } {
  if (!authEnabled()) return { valid: true, user: 'dev' }

  try {
    const decoded  = Buffer.from(token, 'base64').toString('utf-8')
    const colonIdx = decoded.indexOf(':')
    if (colonIdx < 1) return { valid: false }

    const user     = decoded.slice(0, colonIdx)
    const hashPart = decoded.slice(colonIdx + 1)

    const authorizedUsers = (process.env['AUTHORIZED_USERS'] ?? '')
      .split(',').map(s => s.trim()).filter(Boolean)
    const authHash = process.env['AUTH_HASH'] ?? ''

    if (!authorizedUsers.includes(user)) return { valid: false }
    if (hashPart !== authHash)           return { valid: false }

    return { valid: true, user }
  } catch {
    return { valid: false }
  }
}

export function getSessionToken(cookieHeader: string | string[] | undefined): string | null {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === 'dashboar_session') return part.slice(eq + 1).trim() || null
  }
  return null
}

export function isAuthenticated(cookieHeader: string | string[] | undefined): boolean {
  if (!authEnabled()) return true
  const token = getSessionToken(cookieHeader)
  if (!token) return false
  return validateToken(token).valid
}

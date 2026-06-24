import { useState, useEffect, type ReactNode, type FormEvent } from 'react'
import BoarMark from './BoarMark'

const COOKIE = 'dashboar_session'

function readSessionCookie(): string | null {
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === COOKIE) return part.slice(eq + 1).trim() || null
  }
  return null
}

// Structural check only — server validates the real credentials.
// We just want to avoid flashing the login screen when a valid-looking cookie exists.
function looksValid(token: string): boolean {
  try {
    const decoded = atob(token)
    return decoded.indexOf(':') > 0
  } catch {
    return false
  }
}

function checkLocalAuth(): boolean {
  const token = readSessionCookie()
  return token !== null && looksValid(token)
}

export default function AuthGate({ children }: { children: ReactNode }) {
  // Synchronous init — avoids any flash of login screen when cookie is already set
  const [authed,  setAuthed]  = useState(checkLocalAuth)
  const [token,   setToken]   = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Ask the server two things in one call:
    //  1. Is auth even enabled? (AUTH_HASH not set → authEnabled: false → skip gate)
    //  2. Is the current session valid? (confirms the cookie isn't stale)
    fetch('/api/auth')
      .then(r => r.json())
      .then((json: { ok: boolean; authEnabled?: boolean }) => {
        if (!json.authEnabled || json.ok) setAuthed(true)
      })
      .catch(() => {
        // Network error — trust the cookie check already in state
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (authed) return <>{children}</>

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: token.trim() }),
      })
      if (res.ok) {
        setAuthed(true)
      } else {
        const json = await res.json() as { error?: string }
        setError(json.error ?? 'Invalid credentials')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '360px', width: '100%' }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
          <div style={{ animation: 'boarFloat 3.5s ease-in-out infinite' }}>
            <BoarMark size={88} />
          </div>
          <div style={{
            fontFamily: "'Russo One', 'Arial Black', sans-serif",
            fontSize: '22px',
            color: '#0f172a',
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>
            Dashboar
          </div>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 24px rgba(15,23,42,.07)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '3px' }}>
              Access required
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Paste your access token to continue.
            </div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="password"
              placeholder="Access token"
              value={token}
              onChange={e => setToken(e.target.value)}
              autoFocus
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: '0.04em',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                color: '#0f172a',
                transition: 'border-color .15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(129,140,248,.15)' }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
            />

            {error && (
              <div style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              style={{
                width: '100%',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                background: loading || !token.trim() ? '#a5b4fc' : '#4f46e5',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || !token.trim() ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {loading ? 'Verifying…' : 'Continue'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#cbd5e1' }}>
          Your token is{' '}
          <code style={{ fontFamily: 'ui-monospace,monospace' }}>btoa(&quot;{'{'}username{'}'}:{'{'}hash{'}'}&quot;)</code>
        </div>
      </div>

      <style>{`
        @keyframes boarFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}

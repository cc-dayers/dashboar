import { useState, useEffect, useRef, type ReactNode, type FormEvent } from 'react'
import BoarMark from './BoarMark'
import { AuthContext } from '../hooks/useAuth'

// The real session cookie is HttpOnly — not readable by JS.
// A lightweight presence cookie (dashboar_session_present=1) is set alongside it
// so we can skip the login flash without exposing the token.
function checkLocalAuth(): boolean {
  return document.cookie.split(';').some(p => p.trim().startsWith('dashboar_session_present='))
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export default function AuthGate({ children }: { children: ReactNode }) {
  // Synchronous init — avoids any flash of login screen when cookie is already set
  const [authed,      setAuthed]      = useState(checkLocalAuth)
  const [token,       setToken]       = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)  // persists for sidebar
  const [welcomeUser, setWelcomeUser] = useState<string | null>(null)  // cleared after toast
  const [toastOut,    setToastOut]    = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function greet(user: string | undefined | null) {
    if (!user) return
    setCurrentUser(user)
    setWelcomeUser(user)
    setToastOut(false)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => {
      setToastOut(true)
      setTimeout(() => setWelcomeUser(null), 400)
    }, 3200)
  }

  useEffect(() => {
    // Ask the server two things in one call:
    //  1. Is auth even enabled? (AUTH_HASH not set → authEnabled: false → skip gate)
    //  2. Is the current session valid? (confirms the cookie isn't stale)
    fetch('/api/auth')
      .then(r => r.json())
      .then((json: { ok: boolean; authEnabled?: boolean; user?: string }) => {
        if (!json.authEnabled || json.ok) {
          setAuthed(true)
          greet(json.user)
        }
      })
      .catch(() => {
        // Network error — trust the cookie check already in state
      })
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        const json = await res.json() as { ok: boolean; user?: string }
        setAuthed(true)
        greet(json.user)
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

  const toast = welcomeUser && (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      background: 'var(--color-foreground)',
      color: 'var(--color-background)',
      padding: '9px 16px',
      borderRadius: '99px',
      fontSize: '13px',
      fontWeight: 500,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      opacity: toastOut ? 0 : 1,
      transform: toastOut ? 'translateY(6px)' : 'translateY(0)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      Hello, {capitalize(welcomeUser)}
    </div>
  )

  if (authed) return (
    <AuthContext.Provider value={currentUser}>
      {children}{toast}
    </AuthContext.Provider>
  )


  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-background)',
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
            color: 'var(--color-foreground)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>
            Dashboar
          </div>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 24px rgba(15,23,42,.07)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground-secondary)', marginBottom: '3px' }}>
              Access required
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-foreground-subtle)' }}>
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
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                color: 'var(--color-foreground)',
                background: 'var(--color-surface)',
                transition: 'border-color .15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent-muted)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(129,140,248,.15)' }}
              onBlur={e  => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
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
                background: loading || !token.trim() ? 'var(--color-accent-muted)' : 'var(--color-accent)',
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

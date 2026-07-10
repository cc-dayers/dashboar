import { useState } from 'react'
import JsonView from './JsonView'
import PanelTopBar from './PanelTopBar'

/**
 * Full-screen raw JSON overlay, reusable across every report type.
 * Dashboards render this on top of their existing content (as a fixed,
 * full-viewport layer) when the user toggles "View JSON" — no per-report
 * wiring needed beyond passing in whatever `data` is currently in view
 * (the full report for the overview, or a single item for a detail view).
 */

interface Props {
  data:     unknown
  title:    string
  subtitle?: string
  onClose:  () => void
}

export default function RawJsonModal({ data, title, subtitle, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const pretty = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pretty)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API unavailable — silently ignore
    }
  }

  const handleDownload = () => {
    const blob = new Blob([pretty], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'report'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'var(--color-background)',
      display: 'flex', flexDirection: 'column',
    }}>
      <PanelTopBar
        left={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground)' }}>{title}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-foreground-subtle)' }}>{subtitle ?? 'Raw JSON'}</span>
          </div>
        }
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ActionButton onClick={handleCopy}>{copied ? 'Copied ✓' : 'Copy'}</ActionButton>
            <ActionButton onClick={handleDownload}>Download</ActionButton>
            <ActionButton onClick={onClose} primary>Close</ActionButton>
          </div>
        }
      />
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px' }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          background: 'var(--color-surface-sunken)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px', padding: '16px 18px',
        }}>
          <JsonView data={data} />
        </div>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
        padding: '5px 12px', borderRadius: '6px',
        border: primary ? 'none' : '1px solid var(--color-border)',
        background: primary ? 'var(--color-accent, #7c3aed)' : 'var(--color-surface)',
        color: primary ? '#fff' : 'var(--color-foreground-secondary)',
      }}
    >
      {children}
    </button>
  )
}

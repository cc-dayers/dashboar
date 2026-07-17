import { useEffect, useState } from 'react'
import { marked } from 'marked'
import PanelTopBar from './PanelTopBar'
import { registry } from '../reports'

/**
 * Full-screen docs overlay — static markdown files under public/docs/,
 * rendered client-side. Left nav lists "General" plus one entry per
 * registered report type that declares a `docs` path.
 */

interface Topic {
  key:   string
  label: string
  path:  string
}

const GENERAL_TOPIC: Topic = { key: 'general', label: 'General', path: '/docs/general.md' }

function buildTopics(): Topic[] {
  const reportTopics = Object.entries(registry)
    .filter((entry): entry is [string, typeof entry[1] & { docs: string }] => Boolean(entry[1].docs))
    .map(([key, entry]) => ({ key, label: entry.label, path: entry.docs }))
  return [GENERAL_TOPIC, ...reportTopics]
}

interface Props {
  /** Registry key to preselect, or 'general'. Falls back to General if unknown. */
  defaultTopic?: string
  onClose: () => void
}

export default function DocsModal({ defaultTopic = 'general', onClose }: Props) {
  const [topics] = useState(buildTopics)
  const [activeKey, setActiveKey] = useState(
    topics.some(t => t.key === defaultTopic) ? defaultTopic : 'general',
  )
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)

  const active = topics.find(t => t.key === activeKey) ?? topics[0]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(active.path)
      .then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(md => { if (!cancelled) setHtml(marked.parse(md, { async: false }) as string) })
      .catch(() => { if (!cancelled) setHtml('<p>Failed to load this doc.</p>') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [active.path])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--color-background)', display: 'flex', flexDirection: 'column' }}>
      <PanelTopBar
        left={<span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground)' }}>Docs</span>}
        right={<ActionButton onClick={onClose} primary>Close</ActionButton>}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <nav style={{ width: '180px', flexShrink: 0, borderRight: '1px solid var(--color-border)', overflowY: 'auto', padding: '12px 8px' }}>
          {topics.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveKey(t.key)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500,
                background: t.key === activeKey ? 'var(--color-surface-sunken)' : 'transparent',
                color: t.key === activeKey ? 'var(--color-foreground)' : 'var(--color-foreground-muted)',
                border: 'none', cursor: 'pointer', marginBottom: '2px',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {loading ? (
            <div style={{ fontSize: '12px', color: 'var(--color-foreground-muted)' }}>Loading…</div>
          ) : (
            <div className="docs-markdown" style={{ maxWidth: '720px' }} dangerouslySetInnerHTML={{ __html: html }} />
          )}
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

import { useState } from 'react'

/**
 * Generic, reusable pretty-printed / collapsible JSON tree viewer.
 * Used by RawJsonModal (and directly by report dashboards that want an
 * inline JSON block) to render any `unknown` payload without needing
 * per-report-type formatting logic.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

const COLOR = {
  key:      'var(--color-accent, #7c3aed)',
  string:   '#15803d',
  number:   '#1d4ed8',
  boolean:  '#b45309',
  null:     'var(--color-foreground-subtle)',
  punct:    'var(--color-foreground-subtle)',
}

function isObject(v: unknown): v is Record<string, Json> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

interface NodeProps {
  value: unknown
  depth: number
  defaultCollapseDepth: number
}

function Primitive({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span style={{ color: COLOR.null }}>null</span>
  if (typeof value === 'string')  return <span style={{ color: COLOR.string }}>&quot;{value}&quot;</span>
  if (typeof value === 'number')  return <span style={{ color: COLOR.number }}>{value}</span>
  if (typeof value === 'boolean') return <span style={{ color: COLOR.boolean }}>{String(value)}</span>
  return <span>{String(value)}</span>
}

function Collapser({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={collapsed ? 'Expand' : 'Collapse'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: 'var(--color-foreground-subtle)', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px',
        flexShrink: 0, marginRight: '2px',
      }}
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .1s' }}>
        <path d="M1 2.5L4.5 6.5L8 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function Node({ value, depth, defaultCollapseDepth }: NodeProps) {
  const [collapsed, setCollapsed] = useState(depth >= defaultCollapseDepth)

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: COLOR.punct }}>[]</span>
    return (
      <span>
        <Collapser collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <span style={{ color: COLOR.punct }}>[</span>
        {collapsed
          ? <span style={{ color: COLOR.punct, fontStyle: 'italic', cursor: 'pointer' }} onClick={() => setCollapsed(false)}> {value.length} item{value.length !== 1 ? 's' : ''} </span>
          : (
            <div style={{ marginLeft: '18px' }}>
              {value.map((item, i) => (
                <div key={i}>
                  <Node value={item} depth={depth + 1} defaultCollapseDepth={defaultCollapseDepth} />
                  {i < value.length - 1 && <span style={{ color: COLOR.punct }}>,</span>}
                </div>
              ))}
            </div>
          )}
        <span style={{ color: COLOR.punct }}>]</span>
      </span>
    )
  }

  if (isObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return <span style={{ color: COLOR.punct }}>{'{}'}</span>
    return (
      <span>
        <Collapser collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <span style={{ color: COLOR.punct }}>{'{'}</span>
        {collapsed
          ? <span style={{ color: COLOR.punct, fontStyle: 'italic', cursor: 'pointer' }} onClick={() => setCollapsed(false)}> {entries.length} key{entries.length !== 1 ? 's' : ''} </span>
          : (
            <div style={{ marginLeft: '18px' }}>
              {entries.map(([k, v], i) => (
                <div key={k}>
                  <span style={{ color: COLOR.key }}>&quot;{k}&quot;</span>
                  <span style={{ color: COLOR.punct }}>: </span>
                  <Node value={v} depth={depth + 1} defaultCollapseDepth={defaultCollapseDepth} />
                  {i < entries.length - 1 && <span style={{ color: COLOR.punct }}>,</span>}
                </div>
              ))}
            </div>
          )}
        <span style={{ color: COLOR.punct }}>{'}'}</span>
      </span>
    )
  }

  return <Primitive value={value} />
}

interface Props {
  data: unknown
  /** Depth (0-indexed) at which nested objects/arrays start collapsed. Default: 2. */
  defaultCollapseDepth?: number
}

export default function JsonView({ data, defaultCollapseDepth = 2 }: Props) {
  return (
    <pre style={{
      margin: 0,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: '12.5px',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      color: 'var(--color-foreground-secondary)',
    }}>
      <Node value={data as Json} depth={0} defaultCollapseDepth={defaultCollapseDepth} />
    </pre>
  )
}

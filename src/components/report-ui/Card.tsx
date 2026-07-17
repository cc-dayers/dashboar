import type { ReactNode } from 'react'
import { S } from '../../lib/designTokens'

interface Props {
  title:    string
  sub?:     string
  children: ReactNode
}

/** Generic titled surface card used to wrap charts/lists in report overview views. */
export default function Card({ title, sub, children }: Props) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '20px' }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: S.fgSec }}>{title}</div>
        {sub && <div style={{ fontSize: '11px', color: S.fgSubtle, marginTop: '2px' }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

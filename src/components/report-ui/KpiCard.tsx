import type { ReactNode } from 'react'
import { S } from '../../lib/designTokens'

interface Props {
  label:  string
  value:  string
  sub?:   ReactNode
  accent?: string
}

/** Large-number KPI tile used in overview KPI rows. */
export default function KpiCard({ label, value, sub, accent }: Props) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ fontSize: '11px', color: S.fgMuted, marginBottom: '6px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: accent ?? S.fg, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: S.fgSubtle, marginTop: '5px' }}>{sub}</div>}
    </div>
  )
}

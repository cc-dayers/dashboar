import type { ReactNode } from 'react'
import { S } from '../../lib/designTokens'
import MetricLabel from './MetricLabel'

interface Props {
  label:  string
  value:  string
  sub?:   ReactNode
  accent?: string
  explanation?: string
}

/** Large-number KPI tile used in overview KPI rows. */
export default function KpiCard({ label, value, sub, accent, explanation }: Props) {
  return (
    <div role="group" aria-label={label} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ fontSize: '11px', color: S.fgMuted, marginBottom: '6px', fontWeight: 500 }}>
        <MetricLabel explanation={explanation}>{label}</MetricLabel>
      </div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: accent ?? S.fg, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: S.fgSubtle, marginTop: '5px' }}>{sub}</div>}
    </div>
  )
}

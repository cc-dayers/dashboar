import { S } from '../../lib/designTokens'

interface Props {
  label:  string
  value:  string
  sub?:   string
  accent?: string
}

/** Compact-number metric tile used in detail-view metric rows. */
export default function MetricCard({ label, value, sub, accent }: Props) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ fontSize: '11px', color: S.fgMuted, marginBottom: '5px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: accent ?? S.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: S.fgSubtle, marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

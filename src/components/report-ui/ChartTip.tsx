import { S } from '../../lib/designTokens'

interface Props {
  active?: boolean
  payload?: ReadonlyArray<{ value?: number; color?: string; name?: string }>
  label?: string | number
  fmt?: (v: number) => string
}

/** Generic Recharts tooltip renderer for simple bar/line charts. */
export default function ChartTip({ active, payload, label, fmt }: Props) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
      {label && <div style={{ color: S.fgMuted, marginBottom: '4px' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name ? `${p.name}: ` : ''}{fmt ? fmt(Number(p.value) ?? 0) : p.value}
        </div>
      ))}
    </div>
  )
}

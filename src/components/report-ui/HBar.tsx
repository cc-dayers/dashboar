import { S } from '../../lib/designTokens'

interface Props {
  label: string
  value: number
  max:   number
  color: string
  badge?: string
}

/** Horizontal bar row used for top-N breakdowns (findings by hat, author activity, etc). */
export default function HBar({ label, value, max, color, badge }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      <div style={{ fontSize: '11.5px', color: S.fgMuted, width: '130px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
        {label}
      </div>
      <div style={{ flex: 1, background: S.sunken, borderRadius: '4px', height: '7px', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: S.fgSec, width: '28px', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {badge ?? value}
      </div>
    </div>
  )
}

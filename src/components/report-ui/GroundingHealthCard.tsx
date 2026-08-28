import { S } from '../../lib/designTokens'

export interface DiffGroundingSummary {
  enforced: boolean
  degraded: boolean
  degradationReason: string | null
  invalidAnchorCount: number
  invalidArchitectureEvidenceCount: number
  demotedFindingCount: number
  droppedFindingCount: number
  reanchoredFindingCount: number
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: S.fg, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '10px', color: S.fgSubtle, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

export default function GroundingHealthCard({ grounding }: { grounding: DiffGroundingSummary }) {
  const healthy = grounding.enforced && !grounding.degraded
  const accent = healthy
    ? { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'Grounding healthy' }
    : { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', label: grounding.degraded ? 'Grounding degraded' : 'Grounding not enforced' }

  return (
    <div style={{ background: accent.bg, border: `1px solid ${accent.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent.text }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: accent.text }}>{accent.label}</span>
        {grounding.degradationReason && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: accent.text }}>{grounding.degradationReason}</span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <Counter label="invalid anchors" value={grounding.invalidAnchorCount} />
        <Counter label="invalid architecture evidence" value={grounding.invalidArchitectureEvidenceCount} />
        <Counter label="findings reanchored" value={grounding.reanchoredFindingCount} />
        <Counter label="findings demoted" value={grounding.demotedFindingCount} />
        <Counter label="findings dropped" value={grounding.droppedFindingCount} />
      </div>
    </div>
  )
}

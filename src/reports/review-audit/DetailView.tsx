import type { AuditReview, FeedbackSummary, ImprovementSignals } from './types'
import PanelTopBar from '../../components/PanelTopBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
function fmtTokens(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const S = {
  surface:  'var(--color-surface)',
  border:   'var(--color-border)',
  divider:  'var(--color-border-subtle)',
  fg:       'var(--color-foreground)',
  fgSec:    'var(--color-foreground-secondary)',
  fgMuted:  'var(--color-foreground-muted)',
  fgSubtle: 'var(--color-foreground-subtle)',
  sunken:   'var(--color-surface-sunken)',
}

function resultPill(r: string) {
  if (r === 'approved')          return { bg: '#f0fdf4', color: '#16a34a', label: 'Approved' }
  if (r === 'changes-requested') return { bg: '#fef2f2', color: '#dc2626', label: 'Changes Requested' }
  return                                { bg: '#fffbeb', color: '#d97706', label: 'Commented' }
}

const PROVIDER_COLOR: Record<string, string> = {
  azure:   '#0078d4',
  copilot: '#238636',
  codex:   '#7c3aed',
}

const HAT_STYLE: Record<string, { bg: string; color: string }> = {
  'e2e-playwright':        { bg: '#f5f3ff', color: '#7c3aed' },
  'portals-react':         { bg: '#ecfeff', color: '#0e7490' },
  'dotnet-service':        { bg: '#eff6ff', color: '#1d4ed8' },
  'ci-automation':         { bg: '#fffbeb', color: '#b45309' },
  'data-persistence':      { bg: '#f0fdf4', color: '#15803d' },
  'dotnet-best-practices': { bg: '#f8fafc', color: '#475569' },
  'design-review':         { bg: '#fdf4ff', color: '#a21caf' },
  'interfacing':           { bg: '#fff7ed', color: '#c2410c' },
  'agentic-development':   { bg: '#f7fee7', color: '#4d7c0f' },
}
function hatStyle(name: string) { return HAT_STYLE[name] ?? { bg: '#f1f5f9', color: '#475569' } }

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ fontSize: '11px', color: S.fgMuted, marginBottom: '5px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: S.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: S.fgSubtle, marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px', marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: S.fgSec, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function BooleanSignal({ label, value }: { label: string; value: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${S.divider}` }}>
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: value ? '#f0fdf4' : S.sunken,
      }}>
        {value
          ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="var(--color-foreground-subtle)" strokeWidth="1.5" strokeLinecap="round"/></svg>
        }
      </div>
      <span style={{ fontSize: '12.5px', color: value ? S.fgSec : S.fgSubtle }}>{label}</span>
    </div>
  )
}

function FeedbackSection({ fb }: { fb: FeedbackSummary }) {
  const statusStyle =
    fb.collectionStatus === 'complete' ? { bg: '#f0fdf4', color: '#16a34a', label: 'Complete' }
    : fb.collectionStatus === 'partial' ? { bg: '#fffbeb', color: '#d97706', label: 'Partial' }
    : { bg: S.sunken, color: S.fgMuted, label: 'Not Collected' }

  return (
    <Section title="Feedback">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
        {fb.firstHumanReplyAt && (
          <span style={{ fontSize: '11px', color: S.fgSubtle }}>First reply: {fmtDate(fb.firstHumanReplyAt)}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: fb.labels.length > 0 ? '12px' : 0 }}>
        {[
          { label: 'Bot comments', value: fb.botCommentCount },
          { label: 'Human replies', value: fb.humanReplyCount },
          { label: 'Threads resolved', value: fb.threadResolvedCount },
          { label: 'Commits after bot', value: fb.commitsAfterBotComment },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '11px', color: S.fgSubtle, marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: S.fg, fontVariantNumeric: 'tabular-nums' }}>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      {fb.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
          {fb.labels.map(l => (
            <span key={l} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: S.sunken, color: S.fgSec }}>{l}</span>
          ))}
        </div>
      )}
    </Section>
  )
}

function ImprovementSignalsSection({ signals }: { signals: ImprovementSignals }) {
  const sourceLabel: Record<string, string> = {
    hatDetails: 'Hat details',
    state:      'Review state',
    bitbucket:  'Bitbucket comments',
    missing:    'Missing',
  }
  return (
    <Section title="Improvement Signals">
      <BooleanSignal label="Finding details present" value={signals.hasFindingDetails} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${S.divider}` }}>
        <div style={{ fontSize: '12.5px', color: S.fgSec, flex: 1 }}>Finding details source</div>
        <span style={{ fontSize: '11px', fontFamily: 'ui-monospace,monospace', padding: '2px 7px', borderRadius: '4px', background: S.sunken, color: S.fgMuted }}>
          {sourceLabel[signals.findingDetailsSource] ?? signals.findingDetailsSource}
        </span>
      </div>
      <BooleanSignal label="Downstream impact triggered" value={signals.downstreamImpactTriggered} />
      <BooleanSignal label="Model telemetry available" value={signals.hasModelTelemetry} />
      <BooleanSignal label="Cost telemetry available" value={signals.hasCostTelemetry} />
    </Section>
  )
}

function DownstreamImpactSection({ impact }: { impact: Record<string, unknown> }) {
  const triggered = Boolean(impact['triggered'])
  const hasBreaking = Boolean(impact['hasBreakingChanges'])
  const accent = hasBreaking
    ? { text: '#991b1b', sub: '#b91c1c', tagBg: '#fee2e2', border: '#fecaca', bg: '#fef2f2' }
    : { text: '#92400e', sub: '#b45309', tagBg: '#fef3c7', border: '#fed7aa', bg: '#fff7ed' }

  if (!triggered) {
    return (
      <div style={{ background: S.sunken, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', fontSize: '13px', color: S.fgSubtle }}>
        Downstream impact check was not triggered.
      </div>
    )
  }

  const contractCount  = typeof impact['contractCount']  === 'number' ? impact['contractCount']  : null
  const referenceCount = typeof impact['referenceCount'] === 'number' ? impact['referenceCount'] : null
  const validationCount = typeof impact['validationCount'] === 'number' ? impact['validationCount'] : null
  const warningCount   = typeof impact['warningCount']   === 'number' ? impact['warningCount']   : null
  const riskClasses    = Array.isArray(impact['riskClasses'])    ? impact['riskClasses'] as string[]    : []
  const affectedAreas  = Array.isArray(impact['affectedAreas'])  ? impact['affectedAreas'] as string[]  : []

  return (
    <div style={{ background: accent.bg, border: `1px solid ${accent.border}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill={hasBreaking ? '#dc2626' : '#d97706'}>
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 700, color: accent.text }}>
          Downstream Impact{hasBreaking ? ' — Breaking Changes' : ' Detected'}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: accent.sub, marginBottom: '6px' }}>
        {contractCount  != null && <span><strong>{contractCount}</strong> contract{contractCount !== 1 ? 's' : ''} changed</span>}
        {referenceCount != null && <span><strong>{referenceCount}</strong> reference{referenceCount !== 1 ? 's' : ''}</span>}
        {validationCount != null && <span><strong>{validationCount}</strong> validation hint{validationCount !== 1 ? 's' : ''}</span>}
        {(warningCount ?? 0) > 0 && <span><strong>{warningCount}</strong> warning{warningCount !== 1 ? 's' : ''}</span>}
      </div>
      {riskClasses.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {riskClasses.map(c => (
            <span key={c} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: accent.tagBg, color: accent.text, fontWeight: 500 }}>{c}</span>
          ))}
        </div>
      )}
      {affectedAreas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: accent.sub }}>areas:</span>
          {affectedAreas.map(a => (
            <span key={a} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: S.sunken, color: S.fgMuted, fontFamily: 'ui-monospace,monospace' }}>{a}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  review: AuditReview
  onBack: () => void
}

export default function DetailView({ review: r, onBack }: Props) {
  const pill = resultPill(r.result)
  const date = fmtDate(r.reviewedAt)
  const providerColor = r.provider ? (PROVIDER_COLOR[r.provider] ?? S.fgMuted) : S.fgMuted

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelTopBar
        left={
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: S.fgMuted, cursor: 'pointer',
              background: 'none', border: 'none', padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to overview
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-background)' }}>
        {/* PR header card */}
        <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontFamily: 'ui-monospace,monospace', background: S.sunken, color: S.fgSec, borderRadius: '5px', padding: '2px 7px', flexShrink: 0 }}>
              #{r.prNumber}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 10px', flexShrink: 0, background: pill.bg, color: pill.color }}>
              {pill.label}
            </span>
            {r.jiraTicketKey && (
              <span style={{ fontSize: '11px', fontFamily: 'ui-monospace,monospace', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#ede9fe', color: '#4338ca' }}>
                {r.jiraTicketKey}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '16px', fontWeight: 700, color: S.fg, marginBottom: '8px', lineHeight: 1.35 }}>
            {r.prTitle}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: S.fgMuted, marginBottom: '10px' }}>
            <span style={{ fontFamily: 'ui-monospace,monospace', background: S.sunken, borderRadius: '4px', padding: '1px 5px', color: S.fgSec }}>{r.repository}</span>
            {r.branch && <><span>·</span><span style={{ fontFamily: 'ui-monospace,monospace', color: S.fgSec }}>{r.branch}</span></>}
            {r.workspace && <><span>·</span><span>{r.workspace}</span></>}
            <span>·</span>
            <span>{date}</span>
            {!r.authorPresent && <><span>·</span><span style={{ color: S.fgSubtle, fontStyle: 'italic' }}>no author info</span></>}
          </div>

          {/* Model tag */}
          {(r.model || r.provider) && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', borderRadius: '6px', padding: '3px 8px', background: providerColor + '14', border: `1px solid ${providerColor}30` }}>
              {r.provider && (
                <span style={{ fontWeight: 700, color: providerColor, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '9px' }}>{r.provider}</span>
              )}
              {r.model && (
                <span style={{ fontFamily: 'ui-monospace,monospace', color: S.fgSec }}>{r.model}</span>
              )}
              {r.modelsUsedCount > 1 && (
                <span style={{ color: S.fgSubtle, fontSize: '10px' }}>+{r.modelsUsedCount - 1} more</span>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '20px 24px', maxWidth: '820px', margin: '0 auto' }}>
          {/* Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: r.aicCreditsUsed != null ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
            gap: '12px', marginBottom: '14px',
          }}>
            <MetricCard label="Review Time"     value={fmtMs(r.timeToReviewMs)} />
            <MetricCard label="Accuracy"         value={`${r.accuracyRating}%`} />
            <MetricCard label="Tokens / Cost"    value={fmtTokens(r.tokensUsed)} sub={`$${r.estimatedCostUsd.toFixed(2)}`} />
            {r.aicCreditsUsed != null && <MetricCard label="AIC Credits" value={String(r.aicCreditsUsed)} />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '14px' }}>
            <MetricCard label="Findings" value={String(r.findingCount)} />
            <MetricCard label="Models Used" value={String(r.modelsUsedCount)} />
          </div>

          {/* Hats */}
          <Section title="Hats Worn">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {r.hats.map(hat => {
                const s = hatStyle(hat)
                return (
                  <span key={hat} style={{ fontSize: '12px', fontWeight: 500, borderRadius: '6px', padding: '4px 10px', background: s.bg, color: s.color }}>{hat}</span>
                )
              })}
            </div>
          </Section>

          {/* Downstream impact */}
          {r.downstreamImpact && (
            <DownstreamImpactSection impact={r.downstreamImpact} />
          )}

          {/* Feedback */}
          <FeedbackSection fb={r.feedback} />

          {/* Improvement signals */}
          <ImprovementSignalsSection signals={r.improvementSignals} />
        </div>
      </div>
    </div>
  )
}

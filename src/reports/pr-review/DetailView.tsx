import type { PrReview, ReviewFinding, DownstreamImpactSummary, ModelUsageEntry } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
function fmtTokens(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }

// ── Author avatar ─────────────────────────────────────────────────────────────

const PALETTE = ['#3b82f6','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444','#14b8a6','#f97316','#84cc16']

function authorBg(n: string) {
  if (!n) return PALETTE[0]
  return PALETTE[n.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]
}

function initials(n: string) {
  const p = (n || '').trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

// ── Hat style map ─────────────────────────────────────────────────────────────

const HAT_STYLE: Record<string, { bg: string; color: string }> = {
  'e2e-playwright':       { bg: '#f5f3ff', color: '#7c3aed' },
  'portals-react':        { bg: '#ecfeff', color: '#0e7490' },
  'dotnet-service':       { bg: '#eff6ff', color: '#1d4ed8' },
  'ci-automation':        { bg: '#fffbeb', color: '#b45309' },
  'data-persistence':     { bg: '#f0fdf4', color: '#15803d' },
  'dotnet-best-practices':{ bg: '#f8fafc', color: '#475569' },
  'design-review':        { bg: '#fdf4ff', color: '#a21caf' },
  'interfacing':          { bg: '#fff7ed', color: '#c2410c' },
  'agentic-development':  { bg: '#f7fee7', color: '#4d7c0f' },
}

function hatStyle(name: string) {
  return HAT_STYLE[name] ?? { bg: '#f1f5f9', color: '#475569' }
}

// ── Result pill config ────────────────────────────────────────────────────────

function resultPill(r: string) {
  if (r === 'approved')          return { bg: '#f0fdf4', color: '#16a34a', label: 'Approved' }
  if (r === 'changes-requested') return { bg: '#fef2f2', color: '#dc2626', label: 'Changes Requested' }
  return                                { bg: '#fffbeb', color: '#d97706', label: 'Commented' }
}

// ── Finding card ──────────────────────────────────────────────────────────────

function FindingCard({ f }: { f: ReviewFinding }) {
  const sevStyle = f.severity === 'critical'
    ? { bg: '#fef2f2', color: '#dc2626', label: 'critical' }
    : f.severity === 'major'
    ? { bg: '#fff7ed', color: '#c2410c', label: 'major' }
    : f.severity === 'minor'
    ? { bg: '#f8fafc', color: '#475569', label: 'minor' }
    : null

  return (
    <div style={{ display: 'flex', gap: '12px', padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>{f.description}</div>
          {sevStyle && (
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 7px',
              borderRadius: '4px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
              background: sevStyle.bg, color: sevStyle.color,
            }}>
              {sevStyle.label}
            </span>
          )}
        </div>
        {(f.file || f.line != null) && (
          <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'ui-monospace,monospace', marginTop: '4px' }}>
            {f.file}{f.line != null ? `:${f.line}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  pr:     PrReview
  onBack: () => void
}

export default function DetailView({ pr, onBack }: Props) {
  const pill  = resultPill(pr.result)
  const author = pr.author ?? ''
  const date  = new Date(pr.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Back + PR header card */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px 20px' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', color: '#64748b', cursor: 'pointer',
            background: 'none', border: 'none', padding: 0, marginBottom: '14px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to overview
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          {/* Avatar */}
          {author && (
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
              background: authorBg(author),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '14px', fontWeight: 700,
            }}>
              {initials(author)}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontFamily: 'ui-monospace,monospace', background: '#f1f5f9', color: '#475569', borderRadius: '5px', padding: '2px 7px', flexShrink: 0 }}>
                #{pr.prNumber}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 10px', flexShrink: 0,
                background: pill.bg, color: pill.color,
              }}>
                {pill.label}
              </span>
            </div>

            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '8px', marginBottom: '6px', lineHeight: 1.35 }}>
              {pr.prTitle}
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: '#64748b' }}>
              {author && <span>{author}</span>}
              <span>·</span>
              <span style={{ fontFamily: 'ui-monospace,monospace', background: '#f8fafc', borderRadius: '4px', padding: '1px 5px', color: '#475569' }}>{pr.repository}</span>
              {pr.branch && (
                <>
                  <span>·</span>
                  <span style={{ fontFamily: 'ui-monospace,monospace', color: '#475569' }}>{pr.branch}</span>
                </>
              )}
              <span>·</span>
              <span>{date}</span>
            </div>

            {/* Model / provider info */}
            {(pr.modelsUsed?.length || pr.model) && (
              <div style={{ marginTop: '10px' }}>
                {pr.modelsUsed && pr.modelsUsed.length > 0
                  ? <ModelsUsedSection entries={pr.modelsUsed} />
                  : pr.model && <ModelTag provider={pr.provider} model={pr.model} />
                }
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Metrics row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: pr.aicCreditsUsed != null ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          gap: '12px', marginBottom: '14px',
        }}>
          <MetricCard label="Review Time"   value={fmtMs(pr.timeToReviewMs)} />
          <MetricCard label="Accuracy Rating" value={`${pr.accuracyRating}%`} />
          <MetricCard label="Tokens Used"   value={fmtTokens(pr.tokensUsed)} sub={`$${pr.estimatedCostUsd.toFixed(2)}`} />
          {pr.aicCreditsUsed != null && (
            <MetricCard label="AIC Credits" value={String(pr.aicCreditsUsed)} />
          )}
        </div>

        {/* Jira ticket */}
        {pr.jiraTicket && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#f0f4ff', border: '1px solid #c7d2fe',
            borderRadius: '10px', padding: '10px 16px', fontSize: '13px', marginBottom: '14px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: '#4f46e5' }}>
              <rect x="3" y="3" width="18" height="18" rx="3" fill="#4f46e5" opacity=".15" />
              <path d="M12 7v5l3 3" stroke="#4f46e5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: '#4338ca', fontSize: '12px', flexShrink: 0 }}>
              {pr.jiraTicket.key}
            </span>
            {pr.jiraTicket.title && (
              <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pr.jiraTicket.title}
              </span>
            )}
          </div>
        )}

        {/* Downstream impact */}
        {pr.downstreamImpact?.triggered && (
          <DownstreamImpactBanner impact={pr.downstreamImpact} />
        )}

        {/* Notes */}
        {pr.notes && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: '10px', padding: '12px 16px', fontSize: '13px',
            color: '#1d4ed8', lineHeight: 1.6, marginBottom: '14px',
          }}>
            {pr.notes}
          </div>
        )}

        {/* Hats */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Hats Worn
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {pr.hats.map(hat => {
              const s = hatStyle(hat)
              return (
                <span key={hat} style={{
                  fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                  padding: '4px 10px', background: s.bg, color: s.color,
                }}>
                  {hat}
                </span>
              )
            })}
          </div>
        </div>

        {/* Findings by hat */}
        {pr.hatDetails && pr.hatDetails.length > 0 ? (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Findings by Hat
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pr.hatDetails.map(hat => {
                const s = hatStyle(hat.name)
                const findings = hat.findings ?? []
                return (
                  <div key={hat.name} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{
                      padding: '11px 18px', borderBottom: findings.length ? '1px solid #f1f5f9' : 'none',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{hat.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>
                        {findings.length} finding{findings.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {findings.length > 0 ? (
                      <div style={{ padding: '0 18px' }}>
                        {findings.map((f, i) => <FindingCard key={i} f={f} />)}
                      </div>
                    ) : (
                      <div style={{ padding: '12px 18px', fontSize: '13px', color: '#94a3b8' }}>No findings recorded.</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>No detailed findings stored for this review.</div>
          </div>
        )}
      </div>
    </div>
  )
}

const PROVIDER_COLOR: Record<string, string> = {
  azure:   '#0078d4',
  copilot: '#238636',
  codex:   '#7c3aed',
}

function ModelTag({ provider, model }: { provider?: string; model: string }) {
  const color = provider ? (PROVIDER_COLOR[provider] ?? '#475569') : '#475569'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '11px', borderRadius: '6px', padding: '3px 8px',
      background: color + '14', border: `1px solid ${color}30`,
    }}>
      {provider && (
        <span style={{ fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '9px' }}>{provider}</span>
      )}
      <span style={{ fontFamily: 'ui-monospace,monospace', color: '#1e293b' }}>{model}</span>
    </span>
  )
}

function ModelMeta({ e }: { e: ModelUsageEntry }) {
  return (
    <>
      {e.tier && (
        <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', borderRadius: '4px', padding: '1px 5px' }}>{e.tier}</span>
      )}
      {e.source && (
        <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', borderRadius: '4px', padding: '1px 5px' }}>{e.source}</span>
      )}
      {e.reasoningEffort && (
        <span style={{ fontSize: '10px', color: '#94a3b8' }}>effort: {e.reasoningEffort}</span>
      )}
      {e.attemptedModels && e.attemptedModels.length > 1 && (
        <span style={{ fontSize: '10px', color: '#94a3b8' }} title={`Tried: ${e.attemptedModels.join(' → ')}`}>
          (fallback chain: {e.attemptedModels.length})
        </span>
      )}
    </>
  )
}

function ModelsUsedSection({ entries }: { entries: ModelUsageEntry[] }) {
  if (entries.length === 1) {
    const e = entries[0]!
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <ModelTag provider={e.provider} model={e.model} />
        <ModelMeta e={e} />
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {e.label && (
            <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', minWidth: '80px' }}>{e.label}</span>
          )}
          <ModelTag provider={e.provider} model={e.model} />
          <ModelMeta e={e} />
        </div>
      ))}
    </div>
  )
}

function DownstreamImpactBanner({ impact }: { impact: DownstreamImpactSummary }) {
  const breaking = impact.hasBreakingChanges
  return (
    <div style={{
      background: breaking ? '#fef2f2' : '#fff7ed',
      border: `1px solid ${breaking ? '#fecaca' : '#fed7aa'}`,
      borderRadius: '10px', padding: '12px 16px', marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill={breaking ? '#dc2626' : '#d97706'}>
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 700, color: breaking ? '#991b1b' : '#92400e' }}>
          Downstream Impact Detected{breaking ? ' — Breaking Changes' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: breaking ? '#b91c1c' : '#b45309' }}>
        <span><strong>{impact.contractCount}</strong> contract{impact.contractCount !== 1 ? 's' : ''} changed</span>
        <span><strong>{impact.referenceCount}</strong> downstream reference{impact.referenceCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '5px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

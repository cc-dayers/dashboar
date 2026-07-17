import { getCopilotBillingUsage, type PrReview, type ReviewFinding, type DownstreamImpactSummary, type ModelUsageEntry } from './types'
import { S } from '../../lib/designTokens'
import { fmtMs, fmtTokens } from '../../lib/format'
import { authorBg, initials } from '../../lib/avatar'
import { hatStyle, resultPill, PROVIDER_COLOR as SHARED_PROVIDER_COLOR } from '../../lib/reviewStyles'
import MetricCard from '../../components/report-ui/MetricCard'
import { bitbucketPrUrl, jiraTicketUrl } from '../../lib/links'

// ── Finding card ──────────────────────────────────────────────────────────────

function FindingCard({ f }: { f: ReviewFinding }) {
  const sevStyle = f.severity === 'critical'
    ? { bg: '#fef2f2', color: '#dc2626', label: 'critical' }
    : f.severity === 'major'
    ? { bg: '#fff7ed', color: '#c2410c', label: 'major' }
    : f.severity === 'minor'
    ? { bg: S.sunken, color: S.fgSec, label: 'minor' }
    : null

  // 'issue' is the default/expected case — only badge the type when it's not an issue,
  // so a praise/suggestion finding never gets silently mistaken for a bug report.
  const typeStyle = f.type === 'praise'
    ? { bg: '#f0fdf4', color: '#16a34a', label: 'praise' }
    : f.type === 'suggestion'
    ? { bg: '#eff6ff', color: '#1d4ed8', label: 'suggestion' }
    : null

  return (
    <div style={{ display: 'flex', gap: '12px', padding: '11px 0', borderBottom: `1px solid ${S.divider}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, fontSize: '13px', color: S.fgSec, lineHeight: 1.5 }}>{f.description}</div>
          {typeStyle && (
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 7px',
              borderRadius: '4px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
              background: typeStyle.bg, color: typeStyle.color,
            }}>
              {typeStyle.label}
            </span>
          )}
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
          <div style={{ fontSize: '11px', color: S.fgSubtle, fontFamily: 'ui-monospace,monospace', marginTop: '4px' }}>
            {f.file}{f.line != null ? `:${f.line}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Provider helpers ──────────────────────────────────────────────────────────

const PROVIDER_COLOR = SHARED_PROVIDER_COLOR

function ModelTag({ provider, model }: { provider?: string; model: string }) {
  const color = provider ? (PROVIDER_COLOR[provider] ?? S.fgMuted) : S.fgMuted
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '11px', borderRadius: '6px', padding: '3px 8px',
      background: color + '14', border: `1px solid ${color}30`,
    }}>
      {provider && (
        <span style={{ fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '9px' }}>{provider}</span>
      )}
      <span style={{ fontFamily: 'ui-monospace,monospace', color: S.fgSec }}>{model}</span>
    </span>
  )
}

function ModelChips({ entries }: { entries: ModelUsageEntry[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
      {entries.map((e, i) => {
        const color = PROVIDER_COLOR[e.provider ?? ''] ?? S.fgMuted
        const meta  = [e.tier, e.source, e.reasoningEffort].filter(Boolean).join(' · ')
        const attempts = [
          ...(e.attemptedModels ?? []).map(value => `Model: ${value}`),
          ...(e.attemptedReasoningEfforts ?? []).map(value => `Reasoning: ${value}`),
          ...(e.attemptedConfigurations ?? []).map(value => `Configuration: ${value}`),
        ]
        const attemptCount = Math.max(
          e.attemptedModels?.length ?? 0,
          e.attemptedReasoningEfforts?.length ?? 0,
          e.attemptedConfigurations?.length ?? 0,
        )
        return (
          <span key={i} title={attempts.length > 0 ? attempts.join('\n') : undefined} style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '10px', borderRadius: '5px', padding: '2px 8px',
            background: color + '12', border: `1px solid ${color}28`,
            fontFamily: 'ui-monospace,monospace',
          }}>
            <span style={{ color: S.fgSec }}>{e.label ?? e.model}</span>
            {e.provider && (
              <span style={{ fontWeight: 700, color, textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.05em' }}>
                {e.provider}
              </span>
            )}
            {meta && <span style={{ color: S.fgSubtle }}>{meta}</span>}
            {attemptCount > 0 && (
              <span style={{ color, fontWeight: 600 }}>{attemptCount} attempts</span>
            )}
          </span>
        )
      })}
    </div>
  )
}

function DownstreamImpactBanner({ impact }: { impact: DownstreamImpactSummary }) {
  const breaking = impact.hasBreakingChanges
  const accent   = breaking ? { text: '#991b1b', sub: '#b91c1c', tagBg: '#fee2e2' } : { text: '#92400e', sub: '#b45309', tagBg: '#fef3c7' }
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
        <span style={{ fontSize: '12px', fontWeight: 700, color: accent.text }}>
          Downstream Impact Detected{breaking ? ' — Breaking Changes' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: accent.sub, marginBottom: '6px' }}>
        <span><strong>{impact.contractCount}</strong> contract{impact.contractCount !== 1 ? 's' : ''} changed</span>
        <span><strong>{impact.referenceCount}</strong> downstream reference{impact.referenceCount !== 1 ? 's' : ''}</span>
        {impact.validationCount != null && (
          <span><strong>{impact.validationCount}</strong> validation hint{impact.validationCount !== 1 ? 's' : ''}</span>
        )}
        {(impact.warningCount ?? 0) > 0 && (
          <span><strong>{impact.warningCount}</strong> warning{impact.warningCount !== 1 ? 's' : ''}</span>
        )}
      </div>
      {impact.riskClasses && impact.riskClasses.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {impact.riskClasses.map(c => (
            <span key={c} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: accent.tagBg, color: accent.text, fontWeight: 500 }}>{c}</span>
          ))}
        </div>
      )}
      {impact.affectedAreas && impact.affectedAreas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: accent.sub }}>areas:</span>
          {impact.affectedAreas.map(a => (
            <span key={a} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: S.sunken, color: S.fgMuted, fontFamily: 'ui-monospace,monospace' }}>{a}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
        background: S.sunken, color: S.fgSec, textDecoration: 'none', whiteSpace: 'nowrap',
      }}
    >
      {children}
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        <path d="M3 7L7 3M3 3h4v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </a>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '9.5px', fontWeight: 600, color: S.fgSubtle, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '12px', color: S.fgSec, fontWeight: mono ? undefined : 500,
        fontFamily: mono ? 'ui-monospace,monospace' : undefined,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
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
  const billingUsage = getCopilotBillingUsage(pr)
  const billingLabel = 'AI Credits'
  const pill  = resultPill(pr.result)
  const author = pr.author ?? ''
  const date  = new Date(pr.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const prUrl   = bitbucketPrUrl(pr.repository, pr.prNumber)
  const jiraUrl = jiraTicketUrl(pr.jiraTicket?.key)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
      {/* Unified header card */}
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>

        {/* Nav row: back ←——————————→ #PR  pill  date */}
        <div style={{
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', gap: '10px',
          borderBottom: `1px solid ${S.divider}`,
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', color: S.fgMuted, cursor: 'pointer',
              background: 'none', border: 'none', padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to overview
          </button>
          <div style={{ flex: 1 }} />
          {prUrl && <LinkButton href={prUrl}>Bitbucket PR</LinkButton>}
          {jiraUrl && <LinkButton href={jiraUrl}>Jira Ticket</LinkButton>}
          <span style={{ fontSize: '11px', fontFamily: 'ui-monospace,monospace', background: S.sunken, color: S.fgSec, borderRadius: '5px', padding: '2px 7px' }}>
            #{pr.prNumber}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 10px', background: pill.bg, color: pill.color }}>
            {pill.label}
          </span>
          <span style={{ fontSize: '12px', color: S.fgSubtle }}>{date}</span>
        </div>

        {/* PR identity row: avatar + title + metadata */}
        <div style={{ padding: '16px 24px 18px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          {author && (
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
              background: authorBg(author), display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700,
            }}>
              {initials(author)}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '15px', fontWeight: 700, color: S.fg, margin: '0 0 10px', lineHeight: 1.4 }}>
              {pr.prTitle}
            </h1>

            {/* Metadata strip — labeled datapoints */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
              {author && <Field label="Author" value={author} />}
              <Field label="Repository" value={pr.repository} mono />
              {pr.branch && <Field label="Branch" value={pr.branch} mono />}
              {pr.targetRelease && <Field label="Target Release" value={pr.targetRelease} mono />}
              {pr.workspace && <Field label="Workspace" value={pr.workspace} />}
            </div>

            {/* Model chips — compact horizontal wrap */}
            {(pr.modelsUsed?.length || pr.model) && (
              <div style={{ marginTop: '10px' }}>
                {pr.modelsUsed && pr.modelsUsed.length > 0
                  ? <ModelChips entries={pr.modelsUsed} />
                  : pr.model && <ModelTag provider={pr.provider} model={pr.model} />
                }
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' }}>
          <MetricCard label="Review Time"    value={fmtMs(pr.timeToReviewMs)} />
          <MetricCard label="Accuracy Rating" value={`${pr.accuracyRating}%`} />
          <MetricCard label="Tokens Used"    value={fmtTokens(pr.tokensUsed)} sub={`$${pr.estimatedCostUsd.toFixed(2)}`} />
          <MetricCard label={billingLabel} value={billingUsage ? String(billingUsage.value) : '—'} accent={billingUsage ? '#7c3aed' : undefined} />
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
            {jiraUrl ? (
              <a
                href={jiraUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: '#4338ca', fontSize: '12px', flexShrink: 0, textDecoration: 'none' }}
              >
                {pr.jiraTicket.key} ↗
              </a>
            ) : (
              <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: '#4338ca', fontSize: '12px', flexShrink: 0 }}>
                {pr.jiraTicket.key}
              </span>
            )}
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
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: S.fgSec, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
            <div style={{ fontSize: '11px', fontWeight: 600, color: S.fgSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Findings by Hat
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pr.hatDetails.map(hat => {
                const s = hatStyle(hat.name)
                const findings = hat.findings ?? []
                return (
                  <div key={hat.name} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{
                      padding: '11px 18px', borderBottom: findings.length ? `1px solid ${S.divider}` : 'none',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: S.fgSec }}>{hat.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '11px', color: S.fgSubtle }}>
                        {findings.length} finding{findings.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {findings.length > 0 ? (
                      <div style={{ padding: '0 18px' }}>
                        {findings.map((f, i) => <FindingCard key={i} f={f} />)}
                      </div>
                    ) : (
                      <div style={{ padding: '12px 18px', fontSize: '13px', color: S.fgSubtle }}>No findings recorded.</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px' }}>
            <div style={{ fontSize: '13px', color: S.fgSubtle }}>No detailed findings stored for this review.</div>
          </div>
        )}
      </div>
    </div>
  )
}

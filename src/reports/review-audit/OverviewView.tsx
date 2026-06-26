import type { ReviewAuditReport, AuditSummary, SourceReport, ResultCounts } from './types'
import PanelTopBar from '../../components/PanelTopBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTokens(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const S = {
  surface:   'var(--color-surface)',
  border:    'var(--color-border)',
  fg:        'var(--color-foreground)',
  fgMuted:   'var(--color-foreground-muted)',
  fgSubtle:  'var(--color-foreground-subtle)',
  fgSec:     'var(--color-foreground-secondary)',
  sunken:    'var(--color-surface-sunken)',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px' }}>
      <div style={{ fontSize: '11px', color: S.fgMuted, fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: accent ?? S.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: S.fgSubtle, marginTop: '5px' }}>{sub}</div>}
    </div>
  )
}

function ResultBar({ counts }: { counts: ResultCounts }) {
  const total = counts.approved + counts['changes-requested'] + counts.commented
  if (total === 0) return null
  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px' }}>
      <div style={{ fontSize: '11px', color: S.fgMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Results</div>
      <div style={{ display: 'flex', gap: '3px', borderRadius: '6px', overflow: 'hidden', height: '8px', marginBottom: '12px' }}>
        {counts.approved > 0 && (
          <div style={{ flex: counts.approved, background: '#16a34a' }} title={`Approved: ${counts.approved}`} />
        )}
        {counts['changes-requested'] > 0 && (
          <div style={{ flex: counts['changes-requested'], background: '#dc2626' }} title={`Changes requested: ${counts['changes-requested']}`} />
        )}
        {counts.commented > 0 && (
          <div style={{ flex: counts.commented, background: '#d97706' }} title={`Commented: ${counts.commented}`} />
        )}
      </div>
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
        <span style={{ color: '#16a34a' }}><strong>{counts.approved}</strong> approved <span style={{ color: S.fgSubtle }}>({pct(counts.approved)})</span></span>
        <span style={{ color: '#dc2626' }}><strong>{counts['changes-requested']}</strong> changes <span style={{ color: S.fgSubtle }}>({pct(counts['changes-requested'])})</span></span>
        <span style={{ color: '#d97706' }}><strong>{counts.commented}</strong> commented <span style={{ color: S.fgSubtle }}>({pct(counts.commented)})</span></span>
      </div>
    </div>
  )
}

function FeedbackCard({ summary }: { summary: AuditSummary }) {
  const status = summary.feedbackCollectionStatus
  const statusStyle =
    status === 'complete' ? { bg: '#f0fdf4', color: '#16a34a', label: 'Complete' }
    : status === 'partial' ? { bg: '#fffbeb', color: '#d97706', label: 'Partial' }
    : { bg: S.sunken, color: S.fgMuted, label: 'Not Collected' }

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: S.fgMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feedback</div>
        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {[
          { label: 'Human replies', value: summary.humanReplyCount },
          { label: 'Accepted / thanked', value: summary.acceptedOrThankedCount },
          { label: 'False positives claimed', value: summary.falsePositiveClaimedCount },
          { label: 'No reply observed', value: summary.noObservedReplyCount },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '11px', color: S.fgSubtle, marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: S.fg, fontVariantNumeric: 'tabular-nums' }}>
              {value ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  report: ReviewAuditReport
}

export default function OverviewView({ report }: Props) {
  const summary     = report.summary     ?? {} as AuditSummary
  const sourceReport = report.sourceReport ?? {} as SourceReport

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelTopBar
        left={
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: S.fg }}>Overview</div>
            {report.period && <div style={{ fontSize: '11px', color: S.fgMuted, marginTop: '2px' }}>{report.period}</div>}
          </div>
        }
        right={
          <div style={{ fontSize: '11px', color: S.fgSubtle, textAlign: 'right' }}>
            <div>Generated {fmtDate(report.generatedAt)}</div>
            {sourceReport.reportTitle && (
              <div style={{ color: S.fgMuted, marginTop: '2px' }}>{sourceReport.reportTitle}</div>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-background)', padding: '20px 24px' }}>
        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
          <KpiCard label="Reviews" value={String(summary.reviewCount)} />
          <KpiCard label="Findings" value={String(summary.findingCount)} sub={`${summary.reviewsWithFindings} reviews with findings`} />
          <KpiCard label="Downstream Impact" value={String(summary.downstreamImpactReviewCount)} sub="reviews triggered" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '14px' }}>
          <KpiCard
            label="Tokens Used"
            value={fmtTokens(summary.totalTokensUsed)}
            sub={`$${summary.estimatedCostUsd.toFixed(2)} estimated cost`}
          />
          <KpiCard
            label="Schema Version"
            value={report.schemaVersion ?? '—'}
            sub={sourceReport.reportSchemaVersion ? `source v${sourceReport.reportSchemaVersion}` : undefined}
          />
        </div>

        {/* Result breakdown */}
        <div style={{ marginBottom: '14px' }}>
          <ResultBar counts={summary.resultCounts} />
        </div>

        {/* Feedback */}
        <div style={{ marginBottom: '14px' }}>
          <FeedbackCard summary={summary} />
        </div>

        {/* Source report info */}
        {(sourceReport.reportGeneratedAt || sourceReport.reportJsonUri) && (
          <div style={{ background: S.sunken, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px 18px', fontSize: '12px', color: S.fgMuted }}>
            <div style={{ fontWeight: 600, color: S.fgSec, marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Source Report</div>
            {sourceReport.reportGeneratedAt && (
              <div style={{ marginBottom: '4px' }}>Generated: {fmtDate(sourceReport.reportGeneratedAt)}</div>
            )}
            {sourceReport.reportSchemaVersion && (
              <div style={{ marginBottom: '4px' }}>Schema: v{sourceReport.reportSchemaVersion}</div>
            )}
            {sourceReport.reportJsonUri && (
              <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '11px', color: S.fgSubtle, wordBreak: 'break-all' }}>
                {sourceReport.reportJsonUri}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

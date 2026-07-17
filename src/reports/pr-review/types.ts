export type ReviewResult = 'approved' | 'changes-requested' | 'commented'
export type FindingType = 'issue' | 'suggestion' | 'praise'
export type FindingSeverity = 'critical' | 'major' | 'minor'
export type LlmProvider = 'azure' | 'copilot' | 'codex'
export interface CopilotBillingUsage {
  value: number
  unit: 'ai-credits'
}

export interface CopilotUsageSummary {
  source: 'github-copilot-usage-metrics'
  scopeType: 'organization' | 'enterprise'
  scope: string
  reportStartDay: string
  reportEndDay: string
  totalAiCreditsUsed: number
  userCount: number
}

export interface ModelUsageEntry {
  provider: LlmProvider
  model: string
  label?: string
  source?: string
  tier?: string
  reasoningEffort?: string
  attemptedModels?: string[]
  attemptedReasoningEfforts?: string[]
  attemptedConfigurations?: string[]
}

export interface ReviewFinding {
  type?: FindingType
  severity?: FindingSeverity
  description: string
  file?: string
  line?: number
}

export interface ReviewHat {
  name: string
  findings?: ReviewFinding[]
}

export interface JiraTicketRef {
  key: string
  title?: string
}

export interface DownstreamImpactSummary {
  triggered: boolean
  contractCount: number
  referenceCount: number
  hasBreakingChanges: boolean
  riskClasses?: string[]
  affectedAreas?: string[]
  validationCount?: number
  warningCount?: number
}

export interface PrReview {
  id: string
  prNumber: number
  prTitle: string
  repository: string
  branch?: string
  /** Release the PR targets (e.g. "release/6.30"), when the producer supplies it. */
  targetRelease?: string
  author?: string
  reviewedAt: string
  timeToReviewMs: number
  accuracyRating: number
  result: ReviewResult
  workspace?: string | null
  hats: string[]
  hatDetails?: ReviewHat[]
  tokensUsed: number
  estimatedCostUsd: number
  aicCreditsUsed?: number
  copilotBillingUsage?: CopilotBillingUsage
  model?: string
  provider?: LlmProvider
  modelsUsed?: ModelUsageEntry[]
  notes?: string
  jiraTicket?: JiraTicketRef
  downstreamImpact?: DownstreamImpactSummary
}

export function getCopilotBillingUsage(review: PrReview): CopilotBillingUsage | null {
  if (review.copilotBillingUsage?.value != null && review.copilotBillingUsage.unit === 'ai-credits') {
    return review.copilotBillingUsage
  }
  if (review.aicCreditsUsed != null) return { value: review.aicCreditsUsed, unit: 'ai-credits' }
  return null
}

export interface PrReviewReport {
  $schema?: string
  schemaVersion?: string
  title?: string
  subtitle?: string
  generatedAt?: string
  period?: string
  copilotUsage?: CopilotUsageSummary
  reviews: PrReview[]
}


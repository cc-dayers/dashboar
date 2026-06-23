export type ReviewResult = 'approved' | 'changes-requested' | 'commented'
export type FindingType = 'issue' | 'suggestion' | 'praise'
export type FindingSeverity = 'critical' | 'major' | 'minor'
export type LlmProvider = 'azure' | 'copilot' | 'codex'

export interface ModelUsageEntry {
  provider: LlmProvider
  model: string
  label?: string
  source?: string
  tier?: string
  reasoningEffort?: string
  attemptedModels?: string[]
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
}

export interface PrReview {
  id: string
  prNumber: number
  prTitle: string
  repository: string
  branch?: string
  author?: string
  reviewedAt: string
  timeToReviewMs: number
  accuracyRating: number
  result: ReviewResult
  hats: string[]
  hatDetails?: ReviewHat[]
  tokensUsed: number
  estimatedCostUsd: number
  aicCreditsUsed?: number
  model?: string
  provider?: LlmProvider
  modelsUsed?: ModelUsageEntry[]
  notes?: string
  jiraTicket?: JiraTicketRef
  downstreamImpact?: DownstreamImpactSummary
}

export interface PrReviewReport {
  $schema?: string
  schemaVersion?: string
  title?: string
  subtitle?: string
  generatedAt?: string
  period?: string
  reviews: PrReview[]
}

export const KNOWN_SCHEMA_VERSIONS = new Set(['0', '1'])

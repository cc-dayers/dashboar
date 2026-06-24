export type ReviewResult = 'approved' | 'changes-requested' | 'commented'
export type FeedbackStatus = 'not-collected' | 'partial' | 'complete'
export type FindingDetailsSource = 'hatDetails' | 'state' | 'bitbucket' | 'missing'

export interface ResultCounts {
  approved: number
  'changes-requested': number
  commented: number
}

export interface SourceReport {
  reportJsonUri: string | null
  reportSchemaUri: string | null
  reportSchemaVersion: string | null
  reportGeneratedAt: string | null
  reportTitle: string | null
}

export interface AuditSummary {
  reviewCount: number
  findingCount: number
  reviewsWithFindings: number
  downstreamImpactReviewCount: number
  resultCounts: ResultCounts
  totalTokensUsed: number
  estimatedCostUsd: number
  feedbackCollectionStatus: FeedbackStatus
  humanReplyCount: number | null
  acceptedOrThankedCount: number | null
  falsePositiveClaimedCount: number | null
  noObservedReplyCount: number | null
}

export interface FeedbackSummary {
  collectionStatus: FeedbackStatus
  botCommentCount: number | null
  humanReplyCount: number | null
  firstHumanReplyAt: string | null
  labels: string[]
  threadResolvedCount: number | null
  commitsAfterBotComment: number | null
}

export interface ImprovementSignals {
  hasFindingDetails: boolean
  findingDetailsSource: FindingDetailsSource
  downstreamImpactTriggered: boolean
  hasModelTelemetry: boolean
  hasCostTelemetry: boolean
}

export interface AuditReview {
  id: string
  prNumber: number
  prTitle: string
  repository: string
  workspace: string | null
  repoSlug: string | null
  branch: string | null
  authorPresent: boolean
  reviewedAt: string | null
  timeToReviewMs: number
  accuracyRating: number
  result: ReviewResult
  hats: string[]
  findingCount: number
  tokensUsed: number
  estimatedCostUsd: number
  aicCreditsUsed: number | null
  model: string | null
  provider: string | null
  modelsUsedCount: number
  jiraTicketKey: string | null
  downstreamImpact: Record<string, unknown> | null
  feedback: FeedbackSummary
  improvementSignals: ImprovementSignals
}

export interface ReviewAuditReport {
  $schema: string
  schemaVersion: string
  generatedAt: string
  period?: string
  sourceReport: SourceReport
  summary: AuditSummary
  reviews: AuditReview[]
}

export type E2eRunStatus = 'passed' | 'failed' | 'flaky' | 'skipped' | 'timedout' | 'interrupted' | 'succeeded' | 'succeeded_with_issues' | 'inProgress' | 'notStarted' | 'cancelling'
export type E2eTestStatus = 'passed' | 'failed' | 'flaky' | 'skipped' | 'timedout'

export interface E2eTestSummary {
  total:    number
  passed:   number
  failed:   number
  skipped:  number
  flaky:    number
  timedout?: number
}

export interface E2eLinks {
  htmlReportUrl?:                string | null
  playwrightWorkspaceReportUrl?: string | null
  adoArtifactsUrl?:              string | null
}

export interface E2eTraceRef {
  testTitle?: string
  file?:      string
  line?:      number
  blobPath?:  string
  url?:       string | null
  proxyPath?: string | null
}

export interface E2eRunEntry {
  id?:              string
  buildId?:         string
  buildNumber?:     string
  suiteName?:       string
  suite?:           string
  suiteSlug?:       string
  jobName?:         string
  matrixLabel?:     string
  branch?:          string
  commit?:          string
  status:           E2eRunStatus
  result?:          string
  generatedAt?:     string
  executionTimeMs?: number
  durationMs?:      number
  testCount?:       number
  playwrightCommand?: string
  workers?:         number
  summary?:         E2eTestSummary
  links?:           E2eLinks
  reportBlobPath?:  string
  reportUrl?:       string | null
  trace?:           E2eTraceRef | null
}

export interface E2eAggregateSummary {
  totalRuns?:      number
  passedRuns?:     number
  failedRuns?:     number
  skippedRuns?:    number
  otherRuns?:      number
  totalTests?:     number
  passedTests?:    number
  failedTests?:    number
  skippedTests?:   number
  flakyTests?:     number
  totalDurationMs?: number
  // legacy fields
  passed?:    number
  failed?:    number
  flaky?:     number
  skipped?:   number
  [key: string]: unknown
}

export interface E2eAggregateReport {
  $schema?:       string
  schemaVersion?: string
  generatedAt?:   string
  updatedAt?:     string
  summary?:       E2eAggregateSummary
  reviews?:       E2eRunEntry[]
  runs?:          E2eRunEntry[]
}

export interface E2eArtifact {
  name?:         string
  contentType?:  string
  relativePath?: string
  blobPath?:     string
  url?:          string | null
  proxyPath?:    string | null
}

export interface E2eTest {
  title:       string
  project?:    string
  file?:       string
  line?:       number
  status:      E2eTestStatus
  durationMs?: number
  error?:      string | null
  artifacts?:  Record<string, E2eArtifact>
}

export interface E2eExecution {
  playwrightCommand?: string
  workers?:           number
}

export interface E2eRunReport {
  $schema?:       string
  schemaVersion?: string
  buildId?:       string
  buildNumber?:   string
  suite?:         string
  suiteName?:     string
  suiteSlug?:     string
  jobName?:       string
  matrixLabel?:   string
  branch?:        string
  commit?:        string
  status:         E2eRunStatus
  result?:        string
  durationMs?:    number
  execution?:     E2eExecution
  summary?:       E2eTestSummary
  links?:         E2eLinks
  tests?:         E2eTest[]
}

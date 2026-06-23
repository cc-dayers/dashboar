export type RunStatus = 'passed' | 'failed' | 'flaky'

export interface TestRun {
  id: string
  suiteName: string
  traceId: string       // blob key for the .zip file, e.g. "traces/run-001.zip"
  timestamp: string     // ISO 8601
  status: RunStatus
  duration?: number     // ms
  browser?: string      // chromium | firefox | webkit
  project?: string      // playwright project name
  totalTests?: number
  passedTests?: number
  failedTests?: number
  skippedTests?: number
}

export interface PlaywrightTraceReport {
  title?: string
  generatedAt?: string
  runs: TestRun[]
}

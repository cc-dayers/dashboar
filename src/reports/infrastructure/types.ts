export type Status = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface ReportItem {
  id: string
  label: string
  value?: string | number | boolean
  status?: Status
  details?: string
  timestamp?: string
  tags?: string[]
  [key: string]: unknown
}

export interface ReportCategory {
  id: string
  name: string
  status?: Status
  items?: ReportItem[]
}

export interface ReportData {
  id?: string
  reportId?: string
  title?: string
  subtitle?: string
  generatedAt?: string
  status?: Status
  metadata?: Record<string, string | number | boolean | null | undefined>
  categories?: ReportCategory[]
  [key: string]: unknown
}

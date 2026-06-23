import type { ReportData, Status } from './types'

const STATUS_BADGE: Record<Status, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  error: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

const STATUS_DOT: Record<Status, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

interface Props {
  data: ReportData
  reportId: string
}

export default function Header({ data, reportId }: Props) {
  const status = data.status ?? 'neutral'

  return (
    <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 leading-none mb-0.5">Show Me</p>
          <h1 className="text-base font-semibold text-slate-900 truncate">
            {data.title ?? reportId}
          </h1>
          {data.subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{data.subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {data.generatedAt && (
          <span className="text-xs text-slate-400 hidden sm:block">{formatDate(data.generatedAt)}</span>
        )}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[status]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
          {status}
        </span>
      </div>
    </header>
  )
}

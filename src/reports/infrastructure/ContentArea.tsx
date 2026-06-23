import type { ReportCategory, ReportData, ReportItem, Status } from './types'

const BADGE: Record<Status, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

function ItemCard({ item }: { item: ReportItem }) {
  const status = item.status ?? 'neutral'
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-sm font-medium text-slate-800 leading-snug">{item.label}</span>
        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${BADGE[status]}`}>
          {status}
        </span>
      </div>
      {item.value !== undefined && (
        <p className="text-sm text-slate-900 font-mono break-all">{formatValue(item.value)}</p>
      )}
      {item.details && (
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.details}</p>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {item.tags.map(tag => (
            <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
      {item.timestamp && (
        <p className="text-xs text-slate-400 mt-2.5">{formatDate(item.timestamp)}</p>
      )}
    </div>
  )
}

const SKIP_KEYS = new Set(['id', 'reportId', 'title', 'subtitle', 'status', 'generatedAt', 'categories', 'metadata'])

function RawDataView({ data }: { data: ReportData }) {
  const metaEntries = Object.entries(data.metadata ?? {})
  const extraEntries = Object.entries(data).filter(([k]) => !SKIP_KEYS.has(k))

  return (
    <div className="space-y-6">
      {metaEntries.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Metadata</h3>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {metaEntries.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-3 gap-4">
                <span className="text-sm text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="text-sm font-medium text-slate-900 text-right break-all">{formatValue(v)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {extraEntries.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Raw Data</h3>
          <div className="bg-slate-950 rounded-xl p-4 overflow-x-auto">
            <pre className="text-xs text-slate-300 font-mono leading-relaxed">
              {JSON.stringify(Object.fromEntries(extraEntries), null, 2)}
            </pre>
          </div>
        </section>
      )}
      {metaEntries.length === 0 && extraEntries.length === 0 && (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
          No displayable fields found in this report.
        </div>
      )}
    </div>
  )
}

interface Props {
  data: ReportData
  category: ReportCategory | null
  hasCategories: boolean
}

export default function ContentArea({ data, category, hasCategories }: Props) {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      {hasCategories && category ? (
        <>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900">{category.name}</h2>
            {category.items && (
              <span className="text-sm text-slate-400">
                {category.items.length} item{category.items.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {category.items && category.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {category.items.map(item => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              No items in this category.
            </div>
          )}
        </>
      ) : (
        <RawDataView data={data} />
      )}
    </main>
  )
}

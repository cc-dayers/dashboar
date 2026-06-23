import type { ReportProps } from '../index'

type JsonPrimitive = string | number | boolean | null
type JsonObject = { [key: string]: JsonValue }
type JsonArray = JsonValue[]
type JsonValue = JsonPrimitive | JsonObject | JsonArray

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function isPrimitive(v: JsonValue): v is JsonPrimitive {
  return v === null || typeof v !== 'object'
}

export default function SimpleDashboard({ data, reportId }: ReportProps) {
  const obj: JsonObject =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as JsonObject)
      : { data: data as JsonValue }

  const title = typeof obj['title'] === 'string' ? obj['title'] : reportId
  const generatedAt = typeof obj['generatedAt'] === 'string' ? obj['generatedAt'] : undefined

  const scalars = Object.entries(obj).filter(
    ([k, v]) => isPrimitive(v) && k !== 'title' && k !== 'generatedAt',
  )
  const complex = Object.entries(obj).filter(([, v]) => !isPrimitive(v))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-0.5">Show Me / Simple</p>
            <h1 className="text-base font-semibold text-slate-900 truncate">{title}</h1>
          </div>
        </div>
        {generatedAt && (
          <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">
            {formatDate(generatedAt)}
          </span>
        )}
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {scalars.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Fields
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {scalars.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3 gap-4">
                  <span className="text-sm text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-medium text-slate-900 text-right break-all">
                    {v === null ? '—' : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {complex.map(([k, v]) => (
          <section key={k}>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 capitalize">
              {k.replace(/_/g, ' ')}
            </h2>
            <div className="bg-slate-950 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-slate-300 font-mono leading-relaxed">
                {JSON.stringify(v, null, 2)}
              </pre>
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

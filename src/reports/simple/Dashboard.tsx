import type { ReportProps } from '../index'
import BoarMark from '../../components/BoarMark'
import ThemeToggle from '../../components/ThemeToggle'

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="relative flex items-center px-5 py-3">
          {/* Left: BoarMark home link */}
          <a
            href="/"
            className="flex-shrink-0 opacity-75 hover:opacity-100 transition-opacity"
            style={{ textDecoration: 'none' }}
          >
            <BoarMark size={30} />
          </a>

          {/* Center: Report title + meta */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <p className="text-xs text-foreground-muted">Simple</p>
            <h1 className="text-sm font-semibold text-foreground leading-tight">{title}</h1>
            {generatedAt && (
              <p className="text-xs text-foreground-subtle mt-0.5 hidden sm:block">
                {formatDate(generatedAt)}
              </p>
            )}
          </div>

          {/* Right: Theme toggle */}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {scalars.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
              Fields
            </h2>
            <div className="bg-surface rounded-xl border border-border divide-y divide-border-subtle">
              {scalars.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3 gap-4">
                  <span className="text-sm text-foreground-muted capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-medium text-foreground text-right break-all">
                    {v === null ? '—' : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {complex.map(([k, v]) => (
          <section key={k}>
            <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3 capitalize">
              {k.replace(/_/g, ' ')}
            </h2>
            <div className="bg-surface-sunken rounded-xl p-4 overflow-x-auto border border-border">
              <pre className="text-xs text-foreground-secondary font-mono leading-relaxed">
                {JSON.stringify(v, null, 2)}
              </pre>
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

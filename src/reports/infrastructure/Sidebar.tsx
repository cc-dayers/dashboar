import type { ReportCategory, Status } from './types'

const DOT: Record<Status, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-300',
}

interface Props {
  categories: ReportCategory[]
  activeCategoryId: string | null
  onSelect: (id: string) => void
}

export default function Sidebar({ categories, activeCategoryId, onSelect }: Props) {
  return (
    <aside className="flex-shrink-0 w-60 bg-white border-r border-slate-200 overflow-y-auto">
      <div className="p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
          Categories
        </p>
        <nav className="space-y-0.5">
          {categories.map(cat => {
            const isActive = cat.id === activeCategoryId
            const status = cat.status ?? 'neutral'
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${DOT[status]}`} />
                  <span className="truncate">{cat.name}</span>
                </span>
                {cat.items && cat.items.length > 0 && (
                  <span className={`flex-shrink-0 tabular-nums text-xs ml-1 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>
                    {cat.items.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

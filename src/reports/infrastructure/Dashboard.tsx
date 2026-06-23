import { useState } from 'react'
import type { ReportCategory, ReportData } from './types'
import ContentArea from './ContentArea'
import Header from './Header'
import Sidebar from './Sidebar'

interface Props {
  data: unknown
  reportId: string
}

export default function Dashboard({ data, reportId }: Props) {
  const report = data as ReportData
  const categories: ReportCategory[] = report.categories ?? []
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    categories[0]?.id ?? null,
  )

  const activeCategory = categories.find(c => c.id === activeCategoryId) ?? null

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <Header data={report} reportId={reportId} />
      <div className="flex flex-1 overflow-hidden">
        {categories.length > 0 && (
          <Sidebar
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelect={setActiveCategoryId}
          />
        )}
        <ContentArea
          data={report}
          category={activeCategory}
          hasCategories={categories.length > 0}
        />
      </div>
    </div>
  )
}

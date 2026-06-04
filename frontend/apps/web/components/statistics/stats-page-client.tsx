'use client'

import { useTranslations } from 'next-intl'
import { StatusDonutChart } from './status-donut-chart'
import { PriorityDonutChart } from './priority-donut-chart'
import { TagBarChart } from './tag-bar-chart'
import { StatusBarChart } from './status-bar-chart'
import { StatsEmptyState } from './stats-empty-state'

interface StatusItem {
  status: string
  label: string
  count: number
}

interface PriorityItem {
  priority: string
  label: string
  count: number
}

interface TagItem {
  tag_id: string
  name: string
  color: string
  count: number
}

interface StatsData {
  total: number
  by_status: StatusItem[]
  by_priority: PriorityItem[]
  by_tag: TagItem[]
}

interface StatsPageClientProps {
  data: StatsData
}

export function StatsPageClient({ data }: StatsPageClientProps) {
  const t = useTranslations('statistics')

  if (data.total === 0) {
    return <StatsEmptyState />
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t('title')}</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 状态分布环形图 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('statusDistribution')}</h2>
          <StatusDonutChart data={data.by_status} total={data.total} />
        </div>

        {/* 优先级分布环形图 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('priorityDistribution')}</h2>
          <PriorityDonutChart data={data.by_priority} total={data.total} />
        </div>

        {/* 标签分布横向柱状图 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('tagDistribution')}</h2>
          {data.by_tag.length > 0 ? (
            <TagBarChart data={data.by_tag} />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
              暂无标签数据
            </div>
          )}
        </div>

        {/* 状态数量横向柱状图 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('statusCount')}</h2>
          <StatusBarChart data={data.by_status} />
        </div>
      </div>
    </div>
  )
}

'use client'

import { StatsCards } from '@/components/stats-cards'
import { TrendChart } from '@/components/trend-chart'
import { StatusDonutChart, PriorityDonutChart } from '@frontend/ui/charts'
import { useTranslations } from 'next-intl'

interface DashboardClientProps {
  stats: {
    total_users: number
    total_tasks: number
    completion_rate: number
    active_users_today: number
    tasks_by_status: { status: string; label: string; count: number }[]
    tasks_by_priority: { priority: string; label: string; count: number }[]
  }
  trend: {
    registration_trend: { date: string; count: number }[]
    task_creation_trend: { date: string; count: number }[]
  } | null
}

export function DashboardClient({ stats, trend }: DashboardClientProps) {
  const t = useTranslations('admin.dashboard')
  const tStats = useTranslations('statistics')

  const statusTotal = (stats.tasks_by_status || []).reduce((sum, s) => sum + s.count, 0)
  const priorityTotal = (stats.tasks_by_priority || []).reduce((sum, s) => sum + s.count, 0)

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t('title')}</h1>
      <StatsCards
        totalUsers={stats.total_users}
        totalTasks={stats.total_tasks}
        completionRate={stats.completion_rate}
        activeToday={stats.active_users_today}
      />
      {trend && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-gray-700">{t('registrationTrend')}</h2>
          <TrendChart
            registrationTrend={trend.registration_trend || []}
            taskCreationTrend={trend.task_creation_trend || []}
            registrationLabel={t('totalUsers')}
            taskLabel={t('totalTasks')}
          />
        </div>
      )}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('statusDistribution')}</h2>
          <StatusDonutChart
            data={stats.tasks_by_status || []}
            total={statusTotal}
            totalLabel={tStats('total')}
          />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('priorityDistribution')}</h2>
          <PriorityDonutChart
            data={stats.tasks_by_priority || []}
            total={priorityTotal}
            totalLabel={tStats('total')}
          />
        </div>
      </div>
    </div>
  )
}

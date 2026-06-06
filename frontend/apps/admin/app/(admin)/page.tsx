import { getAdminStats, getAdminStatsTrend } from '@/actions/admin-stats-actions'
import { DashboardClient } from '@/components/dashboard-client'

export default async function DashboardPage() {
  const [stats, trend] = await Promise.all([
    getAdminStats(),
    getAdminStatsTrend(),
  ])

  if (!stats) {
    return <div className="text-center text-gray-500">Failed to load stats</div>
  }

  return <DashboardClient stats={stats} trend={trend} />
}

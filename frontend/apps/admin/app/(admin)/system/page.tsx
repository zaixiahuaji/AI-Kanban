import { getHealthCheck } from '@/actions/admin-health-actions'
import { HealthStatus } from '@/components/health-status'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'System - Turbo Admin' }

export default async function SystemPage() {
  const health = await getHealthCheck()

  if (!health) {
    return <div className="text-center text-gray-500">Failed to load health check</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">系统监控</h1>
      <HealthStatus
        database={health.database}
        totalUsers={health.total_users}
        activeToday={health.active_users_today}
        apiVersion={health.api_version}
        recentErrors={health.recent_errors || []}
      />
    </div>
  )
}

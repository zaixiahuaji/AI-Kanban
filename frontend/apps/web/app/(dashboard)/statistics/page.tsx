import { getStatistics } from '@/actions/statistics-actions'
import { StatsPageClient } from '@/components/statistics/stats-page-client'

export default async function StatisticsPage() {
  const result = await getStatistics()
  const data = result.success
    ? (result.data as any)
    : { total: 0, by_status: [], by_priority: [], by_tag: [] }

  return <StatsPageClient data={data} />
}

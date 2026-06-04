'use server'

import { getApiClient } from '@/lib/api'
import { authOptions } from '@/lib/auth'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

export async function getStatistics() {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.statistics.statisticsRetrieve()
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: '获取统计数据失败' }
  }
}

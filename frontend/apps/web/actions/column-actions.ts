'use server'

import { getApiClient } from '@/lib/api'
import { authOptions } from '@/lib/auth'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

export async function getColumns() {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.columns.columnsList()
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: '获取列失败' }
  }
}

export async function createColumn(name: string) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.columns.columnsCreate({ name })
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.body as any }
    }
    return { success: false, message: '创建列失败' }
  }
}

export async function updateColumn(
  id: string,
  data: { name?: string },
) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.columns.columnsPartialUpdate(id, {
      name: data.name,
    })
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.body as any }
    }
    return { success: false, message: '更新列失败' }
  }
}

export async function deleteColumn(id: string) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    await apiClient.columns.columnsDestroy(id)
    return { success: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: '删除列失败' }
  }
}

export async function reorderColumns(items: { id: string; position: number }[]) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    // 后端 reorder 接口接收包含 items 数组的请求体
    const response = await apiClient.columns.columnsReorderCreate({
      items: items as any,
    } as any)
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: '排序列失败' }
  }
}

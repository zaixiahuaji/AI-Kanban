'use server'

import { getApiClient } from '@/lib/api'
import { authOptions } from '@/lib/auth'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

export async function getTags() {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.tags.tagsList()
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function createTag(data: { name: string; color: string }) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.tags.tagsCreate({
      name: data.name,
      color: data.color,
    } as any)
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.body as any }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function updateTag(
  id: string,
  data: { name?: string; color?: string },
) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.tags.tagsPartialUpdate(id, {
      name: data.name,
      color: data.color,
    })
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.body as any }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function deleteTag(id: string) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    await apiClient.tags.tagsDestroy(id)
    return { success: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: 'Unknown error' }
  }
}

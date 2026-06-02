'use server'

import { getApiClient } from '@/lib/api'
import { authOptions } from '@/lib/auth'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

export async function getTasks(params?: {
  status?: string
  priority?: string
  tag?: string
  search?: string
  page?: number
}) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.tasks.tasksList(params?.page)
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function createTask(data: {
  title: string
  description?: string
  status?: string
  priority?: string
  due_date?: string | null
  tags?: string[]
}) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.tasks.tasksCreate({
      title: data.title,
      description: data.description || '',
      status: data.status as any,
      priority: data.priority as any,
      due_date: data.due_date as any,
      tags: data.tags || [],
    })
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.body as any }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function updateTask(
  id: string,
  data: {
    title?: string
    description?: string
    status?: string
    priority?: string
    due_date?: string | null
    tags?: string[]
  },
) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.tasks.tasksPartialUpdate(id, {
      title: data.title,
      description: data.description,
      status: data.status as any,
      priority: data.priority as any,
      due_date: data.due_date as any,
      tags: data.tags,
    })
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.body as any }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function deleteTask(id: string) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    await apiClient.tasks.tasksDestroy(id)
    return { success: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function restoreTask(id: string) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    // tasksRestoreCreate 需要 requestBody (TaskDetail)，传空对象即可，后端只关心 id
    const response = await apiClient.tasks.tasksRestoreCreate(id, {} as any)
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function permanentDeleteTask(id: string) {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    await apiClient.tasks.tasksPermanentDestroy(id)
    return { success: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: 'Unknown error' }
  }
}

export async function getTrashTasks() {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.tasks.tasksTrashRetrieve()
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: 'Unknown error' }
  }
}

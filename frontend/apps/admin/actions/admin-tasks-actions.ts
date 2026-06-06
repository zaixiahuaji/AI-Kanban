'use server'

import { adminAuthOptions } from '@/lib/admin-auth'
import { getServerSession } from 'next-auth'

const API_URL = process.env.API_URL || 'http://localhost:8000'

async function getHeaders() {
  const session = await getServerSession(adminAuthOptions)
  if (!session?.user.isStaff) return null
  return {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  }
}

export async function getAdminTasks(params?: {
  search?: string
  user?: string
  status?: string
  priority?: string
  page?: number
}) {
  const headers = await getHeaders()
  if (!headers) return null

  const sp = new URLSearchParams()
  if (params?.search) sp.set('search', params.search)
  if (params?.user) sp.set('user', params.user)
  if (params?.status) sp.set('status', params.status)
  if (params?.priority) sp.set('priority', params.priority)
  if (params?.page) sp.set('page', String(params.page))
  const qs = sp.toString()

  try {
    const res = await fetch(`${API_URL}/api/admin/tasks/${qs ? '?' + qs : ''}`, {
      headers,
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function deleteTask(id: string) {
  const headers = await getHeaders()
  if (!headers) return { success: false }

  try {
    const res = await fetch(`${API_URL}/api/admin/tasks/${id}/`, {
      method: 'DELETE',
      headers,
    })
    return { success: res.ok }
  } catch {
    return { success: false }
  }
}

'use server'

import { adminAuthOptions } from '@/lib/admin-auth'
import { getServerSession } from 'next-auth'

const API_URL = process.env.API_URL

async function getHeaders() {
  const session = await getServerSession(adminAuthOptions)
  if (!session?.user.isStaff) return null
  return {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  }
}

export async function getAdminUsers(params?: {
  search?: string
  status?: string
  page?: number
}) {
  const headers = await getHeaders()
  if (!headers) return null

  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set('search', params.search)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.page) searchParams.set('page', String(params.page))
  const qs = searchParams.toString()

  try {
    const res = await fetch(`${API_URL}/api/admin/users/${qs ? '?' + qs : ''}`, {
      headers,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getAdminUserDetail(id: string) {
  const headers = await getHeaders()
  if (!headers) return null

  try {
    const res = await fetch(`${API_URL}/api/admin/users/${id}/`, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function toggleUserStatus(id: string, isActive: boolean) {
  const headers = await getHeaders()
  if (!headers) return { success: false }

  try {
    const res = await fetch(`${API_URL}/api/admin/users/${id}/`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_active: isActive }),
    })
    return { success: res.ok }
  } catch {
    return { success: false }
  }
}

export async function deleteUser(id: string) {
  const headers = await getHeaders()
  if (!headers) return { success: false }

  try {
    const res = await fetch(`${API_URL}/api/admin/users/${id}/`, {
      method: 'DELETE',
      headers,
    })
    return { success: res.ok }
  } catch {
    return { success: false }
  }
}

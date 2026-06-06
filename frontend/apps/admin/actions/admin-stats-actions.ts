'use server'

import { adminAuthOptions } from '@/lib/admin-auth'
import { getServerSession } from 'next-auth'

const API_URL = process.env.API_URL

export async function getAdminStats() {
  const session = await getServerSession(adminAuthOptions)
  if (!session?.user.isStaff) return null

  try {
    const res = await fetch(`${API_URL}/api/admin/stats/`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getAdminStatsTrend(days = 30) {
  const session = await getServerSession(adminAuthOptions)
  if (!session?.user.isStaff) return null

  try {
    const res = await fetch(`${API_URL}/api/admin/stats/trend/?days=${days}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

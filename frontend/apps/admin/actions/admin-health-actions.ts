'use server'

import { adminAuthOptions } from '@/lib/admin-auth'
import { getServerSession } from 'next-auth'

const API_URL = process.env.API_URL

export async function getHealthCheck() {
  const session = await getServerSession(adminAuthOptions)
  if (!session?.user.isStaff) return null

  try {
    const res = await fetch(`${API_URL}/api/admin/health/`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

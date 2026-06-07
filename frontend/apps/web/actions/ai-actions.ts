'use server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import type { ChatMessage, DailyUsage } from '@/lib/ai-types'

const API_BASE = process.env.API_URL || 'http://api:8000'

async function aiFetch(path: string, options: RequestInit = {}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { success: false, message: '未登录' }
  }
  const token = (session as { accessToken?: string }).accessToken || ''

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: '请求失败' }))
      return { success: false, message: data.detail || '请求失败' }
    }
    const data = await res.json()
    return { success: true, data }
  } catch {
    return { success: false, message: '网络错误' }
  }
}

export async function getChatHistory(): Promise<
  { success: true; data: { messages: ChatMessage[] } } | { success: false; message: string }
> {
  return aiFetch('/api/ai/chat/history/') as Promise<typeof aiFetch>
}

export async function confirmAction(actionId: string) {
  return aiFetch(`/api/ai/actions/${actionId}/confirm/`, { method: 'POST' })
}

export async function cancelAction(actionId: string) {
  return aiFetch(`/api/ai/actions/${actionId}/cancel/`, { method: 'POST' })
}

export async function undoAction(actionId: string) {
  return aiFetch(`/api/ai/actions/${actionId}/undo/`, { method: 'POST' })
}

export async function getUsage(): Promise<
  { success: true; data: DailyUsage } | { success: false; message: string }
> {
  return aiFetch('/api/ai/usage/') as Promise<typeof aiFetch>
}

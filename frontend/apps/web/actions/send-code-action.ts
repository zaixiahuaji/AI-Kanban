'use server'

import { getApiClient } from '@/lib/api'
import { ApiError } from '@frontend/types/api'

export async function sendCodeAction(
  email: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const apiClient = await getApiClient()
    await apiClient.email.sendCodeCreate({ email })
    return { success: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: 'Failed to send verification code' }
    }
    return { success: false, message: 'Unknown error' }
  }
}

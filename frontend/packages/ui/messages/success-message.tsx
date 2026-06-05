'use client'

import type React from 'react'
import type { PropsWithChildren } from 'react'

export function SuccessMessage({ children }: PropsWithChildren) {
  return (
    <div className="mb-6 rounded-lg bg-green-50 p-3 text-sm text-green-600">
      {children}
    </div>
  )
}

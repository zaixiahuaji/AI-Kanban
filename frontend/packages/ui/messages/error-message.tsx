'use client'

import type React from 'react'
import type { PropsWithChildren } from 'react'

export function ErrorMessage({ children }: PropsWithChildren) {
  return (
    <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">
      {children}
    </div>
  )
}

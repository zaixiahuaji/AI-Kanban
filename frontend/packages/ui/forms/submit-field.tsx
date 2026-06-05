'use client'

import type React from 'react'
import { twMerge } from 'tailwind-merge'

export function SubmitField({
  children,
  isLoading
}: React.PropsWithChildren<{
  isLoading?: boolean
}>) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={twMerge(
        'block h-10 w-full rounded-lg bg-gray-900 font-medium text-white transition-colors hover:bg-gray-800',
        isLoading && 'bg-gray-700'
      )}
    >
      {children}
    </button>
  )
}

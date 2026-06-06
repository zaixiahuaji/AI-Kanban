'use client'

import { useSession } from 'next-auth/react'

export function AdminHeader() {
  const { data: session } = useSession()
  const username = session?.user?.username ?? ''

  return (
    <header className="flex h-14 items-center justify-end border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{username}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
          {username.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}

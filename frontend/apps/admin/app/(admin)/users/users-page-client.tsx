'use client'

import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserTable } from '@/components/user-table'
import type { UserRow } from '@/components/user-table'
import { useState, useTransition } from 'react'

interface UsersPageClientProps {
  data: {
    results: UserRow[]
    count: number
    next: string | null
    previous: string | null
  } | null
}

export function UsersPageClient({ data }: UsersPageClientProps) {
  const t = useTranslations('admin.users')
  const tc = useTranslations('admin.common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const currentStatus = searchParams.get('status') ?? ''
  const currentPage = Number(searchParams.get('page') ?? '1')

  const users = data?.results ?? []
  const totalCount = data?.count ?? 0
  const hasNext = !!data?.next
  const hasPrev = !!data?.previous
  const totalPages = Math.ceil(totalCount / 20)

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    startTransition(() => {
      router.push(`/users?${params.toString()}`)
    })
  }

  const handleSearch = () => {
    updateParams({ search, page: '' })
  }

  const handleStatusChange = (status: string) => {
    updateParams({ status, page: '' })
  }

  const handlePageChange = (page: number) => {
    updateParams({ page: page > 1 ? String(page) : '' })
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t('title')}</h1>

      {/* 搜索与筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('search')}
            className="w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {tc('confirm')}
          </button>
        </div>
        <select
          value={currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          <option value="">{t('statusAll')}</option>
          <option value="active">{t('statusActive')}</option>
          <option value="disabled">{t('statusDisabled')}</option>
        </select>
        <span className="text-sm text-gray-500">
          {tc('total')}: {totalCount}
        </span>
      </div>

      {/* 表格 */}
      <UserTable users={users} />

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={!hasPrev || isPending}
            onClick={() => handlePageChange(currentPage - 1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tc('previous')}
          </button>
          <span className="text-sm text-gray-500">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={!hasNext || isPending}
            onClick={() => handlePageChange(currentPage + 1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tc('next')}
          </button>
        </div>
      )}
    </div>
  )
}

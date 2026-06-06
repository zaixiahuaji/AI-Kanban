import { getAdminUsers } from '@/actions/admin-users-actions'
import { UsersPageClient } from './users-page-client'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Users - Turbo Admin' }

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const data = await getAdminUsers({
    search: params.search,
    status: params.status,
    page: params.page ? parseInt(params.page) : undefined,
  })

  return <UsersPageClient data={data} />
}

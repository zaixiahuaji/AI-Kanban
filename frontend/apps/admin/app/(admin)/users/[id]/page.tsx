import { getAdminUserDetail } from '@/actions/admin-users-actions'
import { UserDetailClient } from './user-detail-client'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'User Detail - Turbo Admin' }

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getAdminUserDetail(id)

  if (!user) {
    return (
      <div className="py-12 text-center text-gray-500">
        User not found
      </div>
    )
  }

  return <UserDetailClient user={user} />
}

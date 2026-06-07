'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toggleUserStatus, deleteUser } from '@/actions/admin-users-actions'

export interface UserRow {
  id: number
  username: string
  email: string
  is_staff: boolean
  is_active: boolean
  task_count: number
  tag_count: number
  date_joined: string
  last_login: string | null
}

interface UserTableProps {
  users: UserRow[]
}

export function UserTable({ users }: UserTableProps) {
  const t = useTranslations('admin.users')
  const router = useRouter()

  const handleToggleStatus = async (user: UserRow) => {
    const title = user.is_active ? t('confirmDisableTitle') : t('confirmEnableTitle')
    const message = user.is_active ? t('confirmDisableMessage') : t('confirmEnableMessage')
    if (!window.confirm(`${title}\n${message}`)) return

    const result = await toggleUserStatus(String(user.id), !user.is_active)
    if (result.success) {
      router.refresh()
    }
  }

  const handleDelete = async (user: UserRow) => {
    if (!window.confirm(`${t('confirmDeleteTitle')}\n${t('confirmDeleteMessage')}`)) return

    const result = await deleteUser(String(user.id))
    if (result.success) {
      router.refresh()
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}/${m}/${d}`
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
        <p className="text-sm text-gray-500">{t('noRecentTasks')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{t('username')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{t('email')}</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">{t('taskCount')}</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">{t('tagCount')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{t('dateJoined')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{t('lastLogin')}</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">{t('status')}</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{user.username}</span>
                  {user.is_staff && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {t('staff')}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{user.email}</td>
              <td className="px-4 py-3 text-center text-gray-600">{user.task_count}</td>
              <td className="px-4 py-3 text-center text-gray-600">{user.tag_count}</td>
              <td className="px-4 py-3 text-gray-600">{formatDate(user.date_joined)}</td>
              <td className="px-4 py-3 text-gray-600">
                {user.last_login ? formatDate(user.last_login) : t('never')}
              </td>
              <td className="px-4 py-3 text-center">
                {user.is_active ? (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    {t('active')}
                  </span>
                ) : (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    {t('disabled')}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  <Link
                    href={`/users/${user.id}`}
                    className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    {t('view')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(user)}
                    className={`rounded px-2 py-1 text-xs ${
                      user.is_active
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {user.is_active ? t('disable') : t('enable')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(user)}
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    {t('delete')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

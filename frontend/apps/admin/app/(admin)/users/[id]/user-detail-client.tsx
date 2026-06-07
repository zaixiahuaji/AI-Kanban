'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface RecentTask {
  id: number
  title: string
  status: string
  priority: string
  created_at: string
}

interface UserData {
  id: number
  username: string
  email: string
  is_staff: boolean
  is_active: boolean
  date_joined: string
  last_login: string | null
  task_count: number
  tag_count: number
  column_count: number
  recent_tasks: RecentTask[]
}

interface UserDetailClientProps {
  user: UserData
}

export function UserDetailClient({ user }: UserDetailClientProps) {
  const t = useTranslations('admin.users')
  const tc = useTranslations('admin.common')

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}/${m}/${d} ${h}:${min}`
  }

  const stats = [
    { label: t('taskCount'), value: user.task_count, color: 'bg-blue-50 text-blue-700' },
    { label: t('tagCount'), value: user.tag_count, color: 'bg-purple-50 text-purple-700' },
    { label: 'Columns', value: user.column_count, color: 'bg-green-50 text-green-700' },
  ]

  return (
    <div>
      {/* 面包屑导航 */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/users" className="hover:text-gray-700">{t('title')}</Link>
        <span>/</span>
        <span className="text-gray-900">{user.username}</span>
      </div>

      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t('detailTitle')}</h1>

      {/* 基本信息 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-gray-700">{t('basicInfo')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-xs text-gray-500">{t('username')}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-medium text-gray-900">{user.username}</span>
              {user.is_staff && (
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                  {t('staff')}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('email')}</div>
            <div className="mt-1 text-gray-900">{user.email}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('status')}</div>
            <div className="mt-1">
              {user.is_active ? (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  {t('active')}
                </span>
              ) : (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  {t('disabled')}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('dateJoined')}</div>
            <div className="mt-1 text-gray-900">{formatDateTime(user.date_joined)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('lastLogin')}</div>
            <div className="mt-1 text-gray-900">
              {user.last_login ? formatDateTime(user.last_login) : t('never')}
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500">{stat.label}</div>
            <div className={`mt-2 inline-block rounded-lg px-2 py-1 text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 最近任务 */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-gray-700">{t('recentTasks')}</h2>
        {!user.recent_tasks || user.recent_tasks.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noRecentTasks')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Title</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Priority</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {user.recent_tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{task.title}</td>
                    <td className="px-4 py-2 text-gray-600">{task.status}</td>
                    <td className="px-4 py-2 text-gray-600">{task.priority}</td>
                    <td className="px-4 py-2 text-gray-600">{formatDateTime(task.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

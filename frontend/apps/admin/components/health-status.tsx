'use client'

import { useTranslations } from 'next-intl'

interface RecentError {
  time: string
  method: string
  path: string
  status_code: number
  message: string
}

interface StatusCardProps {
  label: string
  value: string | number
  status?: 'ok' | 'error'
}

function StatusCard({ label, value, status }: StatusCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        {status && (
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}
          />
        )}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  )
}

interface HealthStatusProps {
  database: string
  totalUsers: number
  activeToday: number
  apiVersion: string
  recentErrors: RecentError[]
}

export function HealthStatus({ database, totalUsers, activeToday, apiVersion, recentErrors }: HealthStatusProps) {
  const t = useTranslations('admin.system')

  const dbOk = database === 'ok' || database === 'healthy'

  return (
    <div className="space-y-6">
      {/* 状态卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label={t('database')} value={dbOk ? t('statusOk') : t('statusError')} status={dbOk ? 'ok' : 'error'} />
        <StatusCard label={t('totalUsers')} value={totalUsers} />
        <StatusCard label={t('activeToday')} value={activeToday} />
        <StatusCard label={t('apiVersion')} value={apiVersion} />
      </div>

      {/* 最近错误 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('recentErrors')}</h2>

        {recentErrors.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noErrors')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="pb-3 pr-4 font-medium">{t('time')}</th>
                  <th className="pb-3 pr-4 font-medium">{t('method')}</th>
                  <th className="pb-3 pr-4 font-medium">{t('path')}</th>
                  <th className="pb-3 pr-4 font-medium">{t('statusCode')}</th>
                  <th className="pb-3 font-medium">{t('message')}</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((err, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{err.time}</td>
                    <td className="py-3 pr-4 text-gray-600">{err.method}</td>
                    <td className="py-3 pr-4 text-gray-600 font-mono text-xs">{err.path}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        {err.status_code}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 max-w-xs truncate">{err.message}</td>
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

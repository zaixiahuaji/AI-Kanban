'use client'

import { useTranslations } from 'next-intl'
import { restoreTask, permanentDeleteTask } from '@/actions/task-actions'

interface Task {
  id: string
  title: string
  status: string
  deleted_at: string | null
  tags: { id: string; name: string; color: string }[]
}

interface TrashListProps {
  tasks: Task[]
  onRefresh: () => void
}

export function TrashList({ tasks, onRefresh }: TrashListProps) {
  const t = useTranslations('trash')

  const handleRestore = async (id: string) => {
    const result = await restoreTask(id)
    if (result.success) onRefresh()
  }

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm(t('permanentDeleteConfirm'))) return
    const result = await permanentDeleteTask(id)
    if (result.success) onRefresh()
  }

  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">{t('empty')}</div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('taskTitle')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('taskStatus')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('deletedAt')}</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map(task => (
            <tr key={task.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">{task.title}</td>
              <td className="px-4 py-3">
                <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {task.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {task.deleted_at ? new Date(task.deleted_at).toLocaleString() : '-'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleRestore(task.id)}
                    className="rounded px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    {t('restore')}
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(task.id)}
                    className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    {t('permanentDelete')}
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

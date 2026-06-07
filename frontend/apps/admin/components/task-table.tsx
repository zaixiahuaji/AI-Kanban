'use client'

import { useTranslations } from 'next-intl'

// 单个任务的数据结构（对应后端 AdminTaskListSerializer）
export interface TaskItem {
  id: string
  title: string
  status: string
  priority: string
  created_by: {
    id: string
    username: string
    email: string
  }
  tags: { id: string; name: string; color: string }[]
  is_deleted: boolean
  created_at: string
}

interface TaskTableProps {
  tasks: TaskItem[]
  onDelete: (id: string) => void
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-green-50 text-green-700',
}

export function TaskTable({ tasks, onDelete }: TaskTableProps) {
  const t = useTranslations('admin.tasks')

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
        {t('search') && '—'}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-600">{t('taskTitle')}</th>
            <th className="px-4 py-3 font-medium text-gray-600">{t('user')}</th>
            <th className="px-4 py-3 font-medium text-gray-600">{t('status')}</th>
            <th className="px-4 py-3 font-medium text-gray-600">{t('priority')}</th>
            <th className="px-4 py-3 font-medium text-gray-600">{t('tags')}</th>
            <th className="px-4 py-3 font-medium text-gray-600">{t('createdAt')}</th>
            <th className="px-4 py-3 font-medium text-gray-600">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-gray-50">
              {/* 标题 + 已删除标记 */}
              <td className="max-w-[200px] truncate px-4 py-3 font-medium text-gray-900">
                {task.title}
                {task.is_deleted && (
                  <span className="ml-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
                    {t('deleted')}
                  </span>
                )}
              </td>
              {/* 所属用户 */}
              <td className="px-4 py-3 text-gray-600">{task.created_by.username}</td>
              {/* 状态 */}
              <td className="px-4 py-3 text-gray-600">{task.status}</td>
              {/* 优先级（彩色标记） */}
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority] || 'bg-gray-50 text-gray-600'}`}
                >
                  {task.priority}
                </span>
              </td>
              {/* 标签（彩色 chips） */}
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${tag.color}18`,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </td>
              {/* 创建时间 */}
              <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                {(() => { const d = new Date(task.created_at); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` })()}
              </td>
              {/* 操作 */}
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  className="rounded-lg px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50"
                >
                  {t('delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import { deleteTask, getAdminTasks } from '@/actions/admin-tasks-actions'
import { TaskTable, type TaskItem } from '@/components/task-table'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState, useTransition } from 'react'

interface TaskPageData {
  count: number
  next: string | null
  previous: string | null
  results: TaskItem[]
}

export function TasksPageClient({ initialData }: { initialData: TaskPageData | null }) {
  const t = useTranslations('admin.tasks')
  const [data, setData] = useState<TaskPageData | null>(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const fetchTasks = useCallback(() => {
    startTransition(async () => {
      const result = await getAdminTasks({
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        page: page > 1 ? page : undefined,
      })
      setData(result)
    })
  }, [search, statusFilter, priorityFilter, page])

  // 搜索/筛选变化时自动刷新，重置页码
  useEffect(() => {
    setPage(1)
    fetchTasks()
  }, [search, statusFilter, priorityFilter])

  // 页码变化时刷新
  useEffect(() => {
    if (page > 1) fetchTasks()
  }, [page])

  const handleDelete = (id: string) => {
    if (!window.confirm(t('confirmDeleteMessage'))) return
    startTransition(async () => {
      const result = await deleteTask(id)
      if (result.success) {
        fetchTasks()
      }
    })
  }

  const pageSize = 20
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t('title')}</h1>

      {/* 搜索和筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* 搜索输入 */}
        <input
          type="text"
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-gray-400"
        />

        {/* 状态筛选 */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-gray-400"
        >
          <option value="">{t('filterAll')}</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        {/* 优先级筛选 */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-gray-400"
        >
          <option value="">{t('filterAll')}</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* 表格 */}
      <div className={isPending ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
        <TaskTable tasks={data?.results || []} onDelete={handleDelete} />
      </div>

      {/* 分页 */}
      {data && data.count > pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            共 {data.count} 条
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!data.previous}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <span className="px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { createTask, deleteTask, updateTask } from '@/actions/task-actions'
import type { Column } from '@/lib/kanban-utils'

interface Tag {
  id: string
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  description: string
  status: string
  priority: string
  due_date: string | null
  tags: Tag[]
}

interface TaskModalProps {
  task?: Task | null // null/undefined = create mode, task object = edit mode
  tags: Tag[]
  columns: Column[]
  onClose: () => void
  onSuccess: () => void
}

export function TaskModal({ task, tags, columns, onClose, onSuccess }: TaskModalProps) {
  const t = useTranslations('kanban')
  const isEdit = !!task
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      status: task?.status || columns[0]?.slug || 'todo',
      priority: task?.priority || 'medium',
      due_date: task?.due_date || '',
      tags: task?.tags.map((tag) => tag.id) || [],
    },
  })

  const onSubmit = async (data: any) => {
    setLoading(true)
    setError(null)

    const payload = {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      due_date: data.due_date || null,
      tags: data.tags,
    }

    const result = isEdit
      ? await updateTask(task.id, payload)
      : await createTask(payload)

    if (result.success) {
      onSuccess()
      onClose()
    } else {
      setError(
        typeof result.message === 'string'
          ? result.message
          : 'Failed to save task',
      )
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!task || !window.confirm(t('deleteConfirm'))) return
    setLoading(true)
    const result = await deleteTask(task.id)
    if (result.success) {
      onSuccess()
      onClose()
    } else {
      setError('Failed to delete task')
    }
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {isEdit ? t('editTask') : t('createTask')}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 标题 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('taskTitle')}
            </label>
            <input
              {...register('title', { required: true })}
              placeholder={t('taskTitlePlaceholder')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-500">Title is required</p>
            )}
          </div>

          {/* 描述 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('taskDescription')}
            </label>
            <textarea
              {...register('description')}
              placeholder={t('taskDescriptionPlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>

          {/* 优先级 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('taskPriority')}
            </label>
            <div className="flex gap-2">
              {['high', 'medium', 'low'].map((p) => (
                <label key={p} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    {...register('priority')}
                    value={p}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    {t(
                      `priority${p.charAt(0).toUpperCase() + p.slice(1)}` as Parameters<typeof t>[0],
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 截止日期 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('taskDueDate')}
            </label>
            <input
              type="date"
              {...register('due_date')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>

          {/* 标签 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('taskTags')}
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    {...register('tags')}
                    value={tag.id}
                    className="rounded text-blue-600"
                  />
                  <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 状态（仅编辑模式） */}
          {isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('taskStatus')}
              </label>
              <select
                {...register('status')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                {columns.map((col) => (
                  <option key={col.slug} value={col.slug}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 按钮 */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="rounded-lg px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {t('delete')}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

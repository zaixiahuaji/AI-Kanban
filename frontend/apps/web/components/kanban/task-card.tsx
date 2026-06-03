'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

// 确定性日期格式化，避免服务端/客户端 locale 不一致导致 hydration 错误
function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return locale === 'zh-CN' ? `${y}/${m}/${day}` : `${m}/${day}/${y}`
}

interface Tag {
  id: string
  name: string
  color: string
}

interface TaskCardProps {
  task: {
    id: string
    title: string
    priority: string
    due_date: string | null
    is_overdue: string
    tags: Tag[]
  }
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const t = useTranslations('kanban')
  const locale = useLocale()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  }

  const priorityKey = `priority${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="mb-2 text-sm font-medium text-gray-900">
        {task.title}
      </div>

      {task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${priorityColors[task.priority] || ''}`}
        >
          {t(priorityKey as Parameters<typeof t>[0])}
        </span>
        {task.due_date && (
          <span
            className={`text-xs ${task.is_overdue ? 'font-medium text-red-600' : 'text-gray-400'}`}
          >
            {task.is_overdue && `${t('overdue')} `}
            {formatDate(task.due_date, locale)}
          </span>
        )}
      </div>
    </div>
  )
}

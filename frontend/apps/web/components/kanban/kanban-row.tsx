'use client'

import { useTranslations } from 'next-intl'

import { KanbanColumn } from './kanban-column'
import { COLUMNS } from '@/lib/kanban-utils'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  is_overdue: string
  tags: { id: string; name: string; color: string }[]
}

interface KanbanRowProps {
  label?: string
  color?: string
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

export function KanbanRow({ label, color, tasks, onTaskClick }: KanbanRowProps) {
  const t = useTranslations('kanban')

  return (
    <div className="mb-4">
      {label && (
        <div className="mb-2 flex items-center gap-2">
          {color && (
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
          )}
          <h3 className="text-sm font-medium text-gray-700">{label}</h3>
          <span className="text-xs text-gray-400">({tasks.length})</span>
        </div>
      )}
      <div className="flex gap-3">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={t(col.labelKey as Parameters<typeof t>[0])}
            tasks={tasks.filter((task) => task.status === col.id)}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  )
}

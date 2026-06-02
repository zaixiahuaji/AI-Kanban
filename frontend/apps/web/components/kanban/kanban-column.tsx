'use client'

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useTranslations } from 'next-intl'

import { TaskCard } from './task-card'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  is_overdue: string
  tags: { id: string; name: string; color: string }[]
}

interface KanbanColumnProps {
  id: string
  title: string
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

export function KanbanColumn({
  id,
  title,
  tasks,
  onTaskClick,
}: KanbanColumnProps) {
  const t = useTranslations('kanban')
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex min-w-[280px] flex-1 flex-col rounded-lg bg-gray-100/50">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 p-2 transition-colors ${isOver ? 'bg-blue-50/50' : ''}`}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-400">
            {t('noTasks')}
          </p>
        )}
      </div>
    </div>
  )
}

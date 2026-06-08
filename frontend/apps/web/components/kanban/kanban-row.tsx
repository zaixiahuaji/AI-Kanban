'use client'

import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'

import { KanbanColumn } from './kanban-column'
import type { Column } from '@/lib/kanban-utils'

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
  rowKey: string
  label?: string
  color?: string
  tasks: Task[]
  columns: Column[]
  onTaskClick?: (task: Task) => void
  onRenameColumn?: (columnId: string, currentName: string) => void
  onDeleteColumn?: (columnId: string) => void
  onAddColumn?: () => void
}

export function KanbanRow({
  rowKey,
  label,
  color,
  tasks,
  columns,
  onTaskClick,
  onRenameColumn,
  onDeleteColumn,
  onAddColumn,
}: KanbanRowProps) {
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
      <SortableContext
        items={columns.map((col) => `col-${col.slug}`)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex gap-3 items-start">
          {columns.map((col) => (
            <KanbanColumn
              key={col.slug}
              id={col.slug}
              rowKey={rowKey}
              title={col.name}
              tasks={tasks.filter((task) => task.status === col.slug)}
              onTaskClick={onTaskClick}
              onRename={onRenameColumn ? () => onRenameColumn(col.id, col.name) : undefined}
              onDelete={onDeleteColumn ? () => onDeleteColumn(col.id) : undefined}
            />
          ))}
          {/* 添加列按钮 */}
          {onAddColumn && (
            <button
              type="button"
              onClick={onAddColumn}
              className="self-start mt-0 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xl text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-500"
            >
              +
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

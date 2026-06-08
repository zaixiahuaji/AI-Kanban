'use client'

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslations } from 'next-intl'

import { TaskCard } from './task-card'
import { KanbanColumnHeader } from './kanban-column-header'

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
  rowKey: string
  title: string
  tasks: Task[]
  onTaskClick?: (task: Task) => void
  onRename?: () => void
  onDelete?: () => void
}

// 用 :: 作为分隔符确保复合 ID 唯一
function makeDroppableId(rowKey: string, columnId: string): string {
  return `${rowKey}::${columnId}`
}

export function KanbanColumn({
  id,
  rowKey,
  title,
  tasks,
  onTaskClick,
  onRename,
  onDelete,
}: KanbanColumnProps) {
  const t = useTranslations('kanban')

  // 任务放置目标
  const droppableId = makeDroppableId(rowKey, id)
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: droppableId })

  // 列拖动排序（列头作为拖拽手柄）
  const {
    attributes: colAttrs,
    listeners: colListeners,
    setNodeRef: setSortableRef,
    transform: colTransform,
    transition: colTransition,
    isDragging: isColDragging,
  } = useSortable({
    id: `col-${id}`,
    data: { type: 'column' },
  })

  const colStyle = {
    transform: CSS.Transform.toString(colTransform),
    transition: colTransition,
    opacity: isColDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setSortableRef}
      style={colStyle}
      className="w-[240px] flex-shrink-0 flex flex-col rounded-lg bg-gray-100/50"
    >
      <KanbanColumnHeader
        title={title}
        count={tasks.length}
        onRename={onRename}
        onDelete={onDelete}
        dragHandleProps={{ ...colAttrs, ...colListeners }}
      />
      <div
        ref={setDropRef}
        className={`flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-200px)] p-2 transition-colors ${isOver ? 'bg-blue-50/50' : ''}`}
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

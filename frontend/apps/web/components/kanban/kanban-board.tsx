'use client'

import { useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useTranslations } from 'next-intl'

import {
  groupTasksByDimension,
  type SwimlaneDimension,
  type Task,
  type Tag,
} from '@/lib/kanban-utils'
import { KanbanRow } from './kanban-row'
import { SwimlaneToggle } from './swimlane-toggle'
import { KanbanFilters } from './kanban-filters'
import { TaskCard } from './task-card'
import { updateTask } from '@/actions/task-actions'

interface KanbanBoardProps {
  initialTasks: Task[]
  tags: Tag[]
  onTaskClick?: (task: Task) => void
}

export function KanbanBoard({
  initialTasks,
  tags,
  onTaskClick,
}: KanbanBoardProps) {
  const t = useTranslations('kanban')
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [swimlane, setSwimlane] = useState<SwimlaneDimension>('none')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // 应用筛选
  const filteredTasks = tasks.filter((task) => {
    if (
      search &&
      !task.title.toLowerCase().includes(search.toLowerCase())
    )
      return false
    if (priorityFilter && task.priority !== priorityFilter) return false
    return true
  })

  const groups = groupTasksByDimension(filteredTasks, swimlane, tags)

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id)
      if (task) setActiveTask(task)
    },
    [tasks],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null)
      const { active, over } = event
      if (!over) return

      const taskId = active.id as string
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      // 根据放置目标确定新状态
      // over.id 可以是列 id (todo/in_progress/done) 或另一个任务 id
      let newStatus = task.status
      const columnIds = ['todo', 'in_progress', 'done']
      if (columnIds.includes(over.id as string)) {
        newStatus = over.id as string
      } else {
        // 放在另一个任务上 — 取该任务所在列的状态
        const targetTask = tasks.find((t) => t.id === over.id)
        if (targetTask) newStatus = targetTask.status
      }

      if (newStatus === task.status) return

      // 乐观更新
      const oldStatus = task.status
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      )

      // 服务端更新
      const result = await updateTask(taskId, { status: newStatus })
      if (!result.success) {
        // 失败时回滚
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: oldStatus } : t,
          ),
        )
      }
    },
    [tasks],
  )

  return (
    <div>
      {/* 头部：筛选和泳道切换 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
          <SwimlaneToggle value={swimlane} onChange={setSwimlane} />
        </div>
        <KanbanFilters
          search={search}
          onSearchChange={setSearch}
          priority={priorityFilter}
          onPriorityChange={setPriorityFilter}
        />
      </div>

      {/* 看板主体：拖拽上下文 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {groups.map((group) => (
          <KanbanRow
            key={group.key}
            label={group.label}
            color={group.color}
            tasks={group.tasks}
            onTaskClick={onTaskClick}
          />
        ))}

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

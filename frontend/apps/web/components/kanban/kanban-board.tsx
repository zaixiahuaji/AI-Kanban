'use client'

import { useCallback, useEffect, useState } from 'react'
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
  type Column,
} from '@/lib/kanban-utils'
import { KanbanRow } from './kanban-row'
import { SwimlaneToggle } from './swimlane-toggle'
import { KanbanFilters } from './kanban-filters'
import { TaskCard } from './task-card'
import { ColumnManageModal } from './column-manage-modal'
import { updateTask } from '@/actions/task-actions'
import { createColumn, updateColumn, deleteColumn } from '@/actions/column-actions'

interface KanbanBoardProps {
  initialTasks: Task[]
  tags: Tag[]
  columns: Column[]
  onColumnsChange: (columns: Column[]) => void
  onTaskClick?: (task: Task) => void
}

export function KanbanBoard({
  initialTasks,
  tags,
  columns,
  onColumnsChange,
  onTaskClick,
}: KanbanBoardProps) {
  const t = useTranslations('kanban')
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [mounted, setMounted] = useState(false)
  const [swimlane, setSwimlane] = useState<SwimlaneDimension>('none')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // 列管理弹窗状态
  const [columnModal, setColumnModal] = useState<{
    open: boolean
    mode: 'create' | 'rename'
    columnId?: string
    initialName?: string
  }>({ open: false, mode: 'create' })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // 当父组件刷新任务列表时，同步到内部状态
  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  // 客户端挂载后才启用 DndContext，避免 hydration 不匹配
  useEffect(() => {
    setMounted(true)
  }, [])

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

  // 解析 droppable ID，提取 rowKey 和 columnId
  const parseDroppableId = useCallback(
    (id: string) => {
      const columnSlugs = columns.map((c) => c.slug)
      // 直接匹配列 slug（无泳道时的 droppable）
      if (columnSlugs.includes(id)) {
        return { rowKey: null, columnId: id }
      }
      // 格式：rowKey::columnId
      const parts = id.split('::')
      if (parts.length === 2 && columnSlugs.includes(parts[1])) {
        return { rowKey: parts[0], columnId: parts[1] }
      }
      return { rowKey: null, columnId: null }
    },
    [columns],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null)
      const { active, over } = event
      if (!over) return

      const taskId = active.id as string
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      // 根据放置目标确定新状态和优先级
      const { rowKey, columnId } = parseDroppableId(over.id as string)
      let newStatus = task.status
      let newPriority = task.priority

      if (columnId) {
        // 放在列容器上
        newStatus = columnId
      } else {
        // 放在另一个任务上 — 取该任务所在列的状态
        const targetTask = tasks.find((t) => t.id === over.id)
        if (targetTask) {
          newStatus = targetTask.status
          if (swimlane === 'priority') newPriority = targetTask.priority
        }
      }

      // 跨优先级拖拽：rowKey 与当前优先级不同时更新
      if (swimlane === 'priority' && rowKey && rowKey !== task.priority) {
        newPriority = rowKey
      }

      // 收集需要更新的字段
      const updates: Record<string, string> = {}
      if (newStatus !== task.status) updates.status = newStatus
      if (newPriority !== task.priority) updates.priority = newPriority
      if (Object.keys(updates).length === 0) return

      // 乐观更新
      const oldStatus = task.status
      const oldPriority = task.priority
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, ...updates }
            : t,
        ),
      )

      // 服务端更新
      const result = await updateTask(taskId, updates)
      if (!result.success) {
        // 失败时回滚
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: oldStatus, priority: oldPriority }
              : t,
          ),
        )
        // 移动失败已自动回滚
      }
    },
    [tasks, swimlane, parseDroppableId],
  )

  // 列管理操作
  const handleColumnSubmit = async (name: string) => {
    if (columnModal.mode === 'create') {
      const result = await createColumn(name)
      if (result.success && result.data) {
        onColumnsChange([...columns, result.data as Column])
      } else {
        window.alert(result.message || t('createColumnFailed'))
      }
    } else if (columnModal.mode === 'rename' && columnModal.columnId) {
      const result = await updateColumn(columnModal.columnId, { name })
      if (result.success && result.data) {
        onColumnsChange(
          columns.map((c) =>
            c.id === columnModal.columnId ? (result.data as Column) : c,
          ),
        )
      } else {
        window.alert(result.message || t('renameColumnFailed'))
      }
    }
  }

  const handleDeleteColumn = async (columnId: string) => {
    const result = await deleteColumn(columnId)
    if (result.success) {
      onColumnsChange(columns.filter((c) => c.id !== columnId))
    } else {
      window.alert(result.message || t('deleteColumnFailed'))
    }
  }

  const handleRenameColumn = (columnId: string, currentName: string) => {
    setColumnModal({
      open: true,
      mode: 'rename',
      columnId,
      initialName: currentName,
    })
  }

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

      {/* 看板主体：水平滚动，分组垂直堆叠 */}
      {mounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
            <div style={{ minWidth: 'max-content' }}>
              {groups.map((group) => (
                <KanbanRow
                  key={group.key}
                  rowKey={group.key}
                  label={group.label}
                  color={group.color}
                  tasks={group.tasks}
                  columns={columns}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onTaskClick={onTaskClick as any}
                  onRenameColumn={handleRenameColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onAddColumn={() => setColumnModal({ open: true, mode: 'create' })}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} />}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
          <div style={{ minWidth: 'max-content' }}>
            {groups.map((group) => (
              <KanbanRow
                key={group.key}
                rowKey={group.key}
                label={group.label}
                color={group.color}
                tasks={group.tasks}
                columns={columns}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onTaskClick={onTaskClick as any}
                onRenameColumn={handleRenameColumn}
                onDeleteColumn={handleDeleteColumn}
                onAddColumn={() => setColumnModal({ open: true, mode: 'create' })}
              />
            ))}
          </div>
        </div>
      )}

      {/* 列管理弹窗 */}
      <ColumnManageModal
        open={columnModal.open}
        mode={columnModal.mode}
        initialName={columnModal.initialName}
        onClose={() => setColumnModal({ open: false, mode: 'create' })}
        onSubmit={handleColumnSubmit}
      />
    </div>
  )
}

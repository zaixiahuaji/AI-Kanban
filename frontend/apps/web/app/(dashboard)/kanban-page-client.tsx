'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { TaskModal } from '@/components/kanban/task-modal'
import { getTasks } from '@/actions/task-actions'
import type { Task, Tag, Column } from '@/lib/kanban-utils'

interface KanbanPageClientProps {
  initialTasks: Task[]
  tags: Tag[]
  columns: Column[]
}

export function KanbanPageClient({ initialTasks, tags, columns }: KanbanPageClientProps) {
  const t = useTranslations('kanban')
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [columnList, setColumnList] = useState<Column[]>(columns)
  // undefined = 关闭, null = 创建模式, task = 编辑模式
  const [modalTask, setModalTask] = useState<Task | null | undefined>(undefined)

  const refreshTasks = async () => {
    const result = await getTasks()
    if (result.success) {
      setTasks(result.data?.results || [])
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setModalTask(null)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          + {t('addTask')}
        </button>
      </div>

      <KanbanBoard
        initialTasks={tasks}
        tags={tags}
        columns={columnList}
        onColumnsChange={setColumnList}
        onTaskClick={(task) => setModalTask(task)}
      />

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          tags={tags}
          columns={columnList}
          onClose={() => setModalTask(undefined)}
          onSuccess={refreshTasks}
        />
      )}
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { getColumns } from '@/actions/column-actions'
import { getTasks } from '@/actions/task-actions'
import { AIAssistantPanel } from '@/components/ai/ai-assistant-panel'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { TaskModal } from '@/components/kanban/task-modal'
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
  const [showAI, setShowAI] = useState(false)

  const refreshTasks = async () => {
    const [taskResult, colResult] = await Promise.all([
      getTasks(),
      getColumns(),
    ])
    if (taskResult.success) {
      setTasks(taskResult.data || [])
    }
    if (colResult.success && colResult.data) {
      setColumnList(colResult.data)
    }
  }

  // 监听 AI 操作完成事件，自动刷新看板
  useEffect(() => {
    const handler = () => { refreshTasks() }
    window.addEventListener('ai-action-done', handler)
    return () => window.removeEventListener('ai-action-done', handler)
  }, [])

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* 看板主区域 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setModalTask(null)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              + {t('addTask')}
            </button>
            <button
              onClick={() => setShowAI(!showAI)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              ✨ AI {showAI ? '✕' : ''}
            </button>
          </div>

          <KanbanBoard
            initialTasks={tasks}
            tags={tags}
            columns={columnList}
            onColumnsChange={setColumnList}
            onTaskClick={(task) => setModalTask(task)}
          />
        </div>
      </div>

      {/* AI 面板 */}
      {showAI && (
        <div className="w-[340px] shrink-0">
          <AIAssistantPanel />
        </div>
      )}

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          tags={tags}
          columns={columnList}
          onClose={() => setModalTask(undefined)}
          onSuccess={refreshTasks}
        />
      )}
    </div>
  )
}

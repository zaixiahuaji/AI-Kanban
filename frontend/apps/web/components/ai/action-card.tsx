'use client'

import { useTranslations } from 'next-intl'

import type { AIAction } from '@/lib/ai-types'

interface ActionCardProps {
  action: AIAction
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onUndo: (id: string) => void
}

const TOOL_LABELS: Record<string, string> = {
  create_task: '📝 create_task',
  move_task: '🔄 move_task',
  create_column: '📋 create_column',
  reorder_columns: '🔀 reorder_columns',
  delete_task: '🗑️ delete_task',
  batch_move_tasks: '🔄 batch_move',
  batch_delete_tasks: '🗑️ batch_delete',
  delete_column: '🗑️ delete_column',
  list_tasks: '🔍 list_tasks',
  list_columns: '🔍 list_columns',
}

export function ActionCard({ action, onConfirm, onCancel, onUndo }: ActionCardProps) {
  const t = useTranslations('ai')

  const borderColor =
    action.status === 'pending'
      ? 'border-red-200'
      : action.status === 'undone'
        ? 'border-gray-200'
        : action.status === 'cancelled'
          ? 'border-gray-200'
          : 'border-green-200'

  return (
    <div className={`rounded-lg border ${borderColor} bg-white p-2.5 text-xs`}>
      <div className="font-medium text-gray-700">
        {TOOL_LABELS[action.tool_name] || action.tool_name}
      </div>
      <div className="mt-1 text-gray-500">
        {formatToolArgs(action.tool_name, action.tool_args, action.result)}
      </div>

      {/* 状态指示 */}
      {action.status === 'executed' && (
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
            ✓ {t('executed')}
          </span>
          <button
            type="button"
            onClick={() => onUndo(action.id)}
            className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-100"
          >
            {t('undo')}
          </button>
        </div>
      )}
      {action.status === 'confirmed' && (
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
            ✓ {t('confirmed')}
          </span>
          <button
            type="button"
            onClick={() => onUndo(action.id)}
            className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-100"
          >
            {t('undo')}
          </button>
        </div>
      )}
      {action.status === 'pending' && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onConfirm(action.id)}
            className="rounded bg-red-50 px-2 py-0.5 text-[10px] text-red-600 transition-colors hover:bg-red-100"
          >
            {t('confirm')}
          </button>
          <button
            type="button"
            onClick={() => onCancel(action.id)}
            className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600 transition-colors hover:bg-gray-100"
          >
            {t('cancel')}
          </button>
        </div>
      )}
      {action.status === 'undone' && (
        <span className="mt-2 inline-block rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
          {t('undone')}
        </span>
      )}
      {action.status === 'cancelled' && (
        <span className="mt-2 inline-block rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
          {t('cancelled')}
        </span>
      )}
    </div>
  )
}

function formatToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  result: Record<string, unknown> | null,
): string {
  switch (toolName) {
    case 'move_task':
      return `「${args.task_title}」→「${args.target_column}」`
    case 'create_task':
      return `创建「${args.title}」`
    case 'delete_task':
      return `删除「${args.task_title}」`
    case 'create_column':
      return `创建列「${args.name}」`
    case 'delete_column':
      return `删除列「${args.column_name}」`
    case 'batch_move_tasks': {
      const titles = (args.task_titles as string[])?.join('、') || ''
      return `${titles} →「${args.target_column}」`
    }
    case 'batch_delete_tasks': {
      const titles = (args.task_titles as string[])?.join('、') || ''
      return `删除 ${titles}`
    }
    case 'reorder_columns': {
      const names = (args.column_names as string[])?.join(' → ') || ''
      return names
    }
    default:
      return JSON.stringify(args)
  }
}

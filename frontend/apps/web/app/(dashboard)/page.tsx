import { getTasks } from '@/actions/task-actions'
import { getTags } from '@/actions/tag-actions'
import { getColumns } from '@/actions/column-actions'
import { KanbanPageClient } from './kanban-page-client'
import type { Column } from '@/lib/kanban-utils'

export default async function HomePage() {
  const [tasksResult, tagsResult, columnsResult] = await Promise.all([
    getTasks(),
    getTags(),
    getColumns(),
  ])

  const tasks = tasksResult.success ? (tasksResult.data?.results || []) : []
  const tags = tagsResult.success ? (tagsResult.data?.results || []) : []
  const columns: Column[] = columnsResult.success
    ? (Array.isArray(columnsResult.data) ? columnsResult.data : (columnsResult.data?.results || []))
    : []

  return (
    <KanbanPageClient initialTasks={tasks} tags={tags} columns={columns} />
  )
}

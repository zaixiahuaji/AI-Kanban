import { getTasks } from '@/actions/task-actions'
import { getTags } from '@/actions/tag-actions'
import { getColumns } from '@/actions/column-actions'
import { KanbanPageClient } from './kanban-page-client'
import type { Column, Task } from '@/lib/kanban-utils'

export default async function HomePage() {
  const [tasksResult, tagsResult, columnsResult] = await Promise.all([
    getTasks(),
    getTags(),
    getColumns(),
  ])

  const tasks = (tasksResult.success ? (tasksResult.data || []) : []) as unknown as Task[]
  const tags = tagsResult.success ? (tagsResult.data || []) : []
  const columns = (columnsResult.success ? (columnsResult.data || []) : []) as unknown as Column[]

  return (
    <KanbanPageClient initialTasks={tasks} tags={tags} columns={columns} />
  )
}

import { getTasks } from '@/actions/task-actions'
import { getTags } from '@/actions/tag-actions'
import { KanbanPageClient } from './kanban-page-client'

export default async function HomePage() {
  const [tasksResult, tagsResult] = await Promise.all([
    getTasks(),
    getTags(),
  ])

  const tasks = tasksResult.success ? (tasksResult.data?.results || []) : []
  const tags = tagsResult.success ? (tagsResult.data?.results || []) : []

  return <KanbanPageClient initialTasks={tasks} tags={tags} />
}

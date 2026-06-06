import { getAdminTasks } from '@/actions/admin-tasks-actions'
import { TasksPageClient } from './tasks-page-client'

export default async function TasksPage() {
  const data = await getAdminTasks()

  if (!data) {
    return (
      <div className="text-center text-gray-500">Failed to load tasks</div>
    )
  }

  return <TasksPageClient initialData={data} />
}

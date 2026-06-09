import { getTrashTasks } from '@/actions/task-actions'
import { TrashPageClient } from './trash-page-client'

export default async function TrashPage() {
  const result = await getTrashTasks()
  const tasks = result.success ? (result.data || []) : []

  return <TrashPageClient initialTasks={tasks} />
}

import { getTrashTasks } from '@/actions/task-actions'
import { TrashPageClient } from './trash-page-client'

export default async function TrashPage() {
  const result = await getTrashTasks()
  // getTrashTasks 返回 TaskDetail，结构含回收站字段，断言为 TrashPageClient 期望的数组
  const tasks = (result.success ? (result.data || []) : []) as any

  return <TrashPageClient initialTasks={tasks} />
}

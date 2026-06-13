'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { TrashList } from '@/components/trash/trash-list'
import { getTrashTasks } from '@/actions/task-actions'

interface Task {
  id: string
  title: string
  status: string
  deleted_at: string | null
  tags: { id: string; name: string; color: string }[]
}

export function TrashPageClient({ initialTasks }: { initialTasks: Task[] }) {
  const t = useTranslations('trash')
  const [tasks, setTasks] = useState(initialTasks)

  const refresh = async () => {
    const result = await getTrashTasks()
    if (result.success) setTasks((result.data || []) as unknown as Task[])
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        {tasks.length > 0 && (
          <p className="mt-1 text-sm text-gray-500">{tasks.length} items</p>
        )}
      </div>
      <TrashList tasks={tasks} onRefresh={refresh} />
    </div>
  )
}

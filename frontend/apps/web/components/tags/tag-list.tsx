'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { deleteTag } from '@/actions/tag-actions'
import { TagForm } from './tag-form'

interface Tag {
  id: string
  name: string
  color: string
  taskCount?: number
}

interface TagListProps {
  tags: Tag[]
  onRefresh: () => void
}

export function TagList({ tags, onRefresh }: TagListProps) {
  const t = useTranslations('tags')
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    const result = await deleteTag(id)
    if (result.success) {
      onRefresh()
    }
  }

  if (tags.length === 0) {
    return <p className="text-sm text-gray-400">No tags yet. Create your first tag above.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tags.map(tag => (
        <div key={tag.id}>
          {editingId === tag.id ? (
            <TagForm
              tag={tag}
              onSuccess={() => { setEditingId(null); onRefresh() }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="font-medium text-gray-900">{tag.name}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingId(tag.id)}
                    className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

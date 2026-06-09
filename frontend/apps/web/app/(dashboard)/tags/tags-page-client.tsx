'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { TagForm } from '@/components/tags/tag-form'
import { TagList } from '@/components/tags/tag-list'
import { getTags } from '@/actions/tag-actions'

interface Tag {
  id: string
  name: string
  color: string
}

export function TagsPageClient({ initialTags }: { initialTags: Tag[] }) {
  const t = useTranslations('tags')
  const [tags, setTags] = useState(initialTags)
  const [showForm, setShowForm] = useState(false)

  const refresh = async () => {
    const result = await getTags()
    if (result.success) setTags(result.data || [])
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          + {t('addTag')}
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <TagForm
            onSuccess={() => { setShowForm(false); refresh() }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <TagList tags={tags} onRefresh={refresh} />
    </div>
  )
}

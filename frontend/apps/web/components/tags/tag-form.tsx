'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ColorPicker } from './color-picker'
import { createTag, updateTag } from '@/actions/tag-actions'

interface Tag {
  id: string
  name: string
  color: string
}

interface TagFormProps {
  tag?: Tag | null
  onSuccess: () => void
  onCancel: () => void
}

export function TagForm({ tag, onSuccess, onCancel }: TagFormProps) {
  const t = useTranslations('tags')
  const isEdit = !!tag
  const [name, setName] = useState(tag?.name || '')
  const [color, setColor] = useState(tag?.color || '#3B82F6')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const result = isEdit
      ? await updateTag(tag.id, { name: name.trim(), color })
      : await createTag({ name: name.trim(), color })

    if (result.success) {
      onSuccess()
    } else {
      setError(typeof result.message === 'string' ? result.message : 'Failed to save tag')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-gray-700">{t('tagName')}</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('tagNamePlaceholder')}
          maxLength={50}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">{t('tagColor')}</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {t('save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}

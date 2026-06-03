'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'

interface ColumnManageModalProps {
  open: boolean
  initialName?: string
  mode: 'create' | 'rename'
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function ColumnManageModal({
  open,
  initialName = '',
  mode,
  onClose,
  onSubmit,
}: ColumnManageModalProps) {
  const t = useTranslations('kanban')
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: initialName },
  })

  const handleFormSubmit = async (data: { name: string }) => {
    setLoading(true)
    try {
      await onSubmit(data.name)
      reset()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-96 rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? t('createColumn') : t('renameColumn')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <input
            {...register('name', { required: true })}
            placeholder={t('columnNamePlaceholder')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

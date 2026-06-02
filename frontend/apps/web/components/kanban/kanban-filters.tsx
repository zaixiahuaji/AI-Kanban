'use client'

import { useTranslations } from 'next-intl'

interface KanbanFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  priority: string
  onPriorityChange: (value: string) => void
}

export function KanbanFilters({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
}: KanbanFiltersProps) {
  const t = useTranslations('kanban')

  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
      >
        <option value="">{t('filterAll')}</option>
        <option value="high">{t('priorityHigh')}</option>
        <option value="medium">{t('priorityMedium')}</option>
        <option value="low">{t('priorityLow')}</option>
      </select>
    </div>
  )
}

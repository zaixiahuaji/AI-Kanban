'use client'

import { useTranslations } from 'next-intl'
import type { SwimlaneDimension } from '@/lib/kanban-utils'

interface SwimlaneToggleProps {
  value: SwimlaneDimension
  onChange: (value: SwimlaneDimension) => void
}

const OPTIONS: { value: SwimlaneDimension; labelKey: string }[] = [
  { value: 'none', labelKey: 'swimlaneNone' },
  { value: 'tag', labelKey: 'swimlaneTag' },
  { value: 'priority', labelKey: 'swimlanePriority' },
]

export function SwimlaneToggle({ value, onChange }: SwimlaneToggleProps) {
  const t = useTranslations('kanban')

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500">
        {t('swimlane')}:
      </span>
      <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              value === opt.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(opt.labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>
    </div>
  )
}

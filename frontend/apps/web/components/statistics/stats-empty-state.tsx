'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function StatsEmptyState() {
  const t = useTranslations('statistics')

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 text-5xl">📊</div>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('emptyTitle')}</h2>
      <p className="mb-6 text-sm text-gray-500">{t('emptyDescription')}</p>
      <Link
        href="/"
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
      >
        {t('goToKanban')}
      </Link>
    </div>
  )
}

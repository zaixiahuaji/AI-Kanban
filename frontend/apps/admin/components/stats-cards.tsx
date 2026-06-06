'use client'

import { useTranslations } from 'next-intl'

interface StatsCardsProps {
  totalUsers: number
  totalTasks: number
  completionRate: number
  activeToday: number
}

export function StatsCards({ totalUsers, totalTasks, completionRate, activeToday }: StatsCardsProps) {
  const t = useTranslations('admin.dashboard')

  const cards = [
    { label: t('totalUsers'), value: totalUsers, color: 'bg-blue-50 text-blue-700' },
    { label: t('totalTasks'), value: totalTasks, color: 'bg-purple-50 text-purple-700' },
    { label: t('completionRate'), value: `${Math.round(completionRate * 100)}%`, color: 'bg-green-50 text-green-700' },
    { label: t('activeToday'), value: activeToday, color: 'bg-amber-50 text-amber-700' },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-gray-500">{card.label}</div>
          <div className={`mt-2 inline-block rounded-lg px-2 py-1 text-2xl font-bold ${card.color}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  )
}

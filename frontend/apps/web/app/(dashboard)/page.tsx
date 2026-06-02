import { getTranslations } from 'next-intl/server'

export default async function HomePage() {
  const t = await getTranslations('kanban')
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
      <p className="mt-2 text-gray-500">Loading kanban...</p>
    </div>
  )
}

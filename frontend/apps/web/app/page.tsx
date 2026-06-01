import { PagesOverview } from '@/components/pages-overview'
import { UserSession } from '@/components/user-session'
import { getTranslations } from 'next-intl/server'

export default async function Home() {
  const t = await getTranslations('home')

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-gray-900">
        {t('title')}
      </h1>

      <p className="mb-12 mt-2 max-w-4xl text-base leading-relaxed text-gray-600">
        {t('description')}
      </p>

      <UserSession />

      <hr className="my-8" />

      <PagesOverview />
    </>
  )
}

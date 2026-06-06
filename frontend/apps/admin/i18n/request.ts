import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { routing } from './routing'

export default getRequestConfig(async () => {
  let locale = routing.defaultLocale

  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value
  if (localeCookie && routing.locales.includes(localeCookie as 'en' | 'zh-CN')) {
    locale = localeCookie as 'en' | 'zh-CN'
  }

  return {
    locale,
    messages: (await import(`@frontend/ui/locales/${locale}.json`)).default
  }
})

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'

export function LanguageSwitcher() {
  const t = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const handleChange = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`
    router.refresh()
  }

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded bg-white px-2 py-1 text-sm shadow-sm outline outline-1 outline-gray-900/10 focus:outline-purple-600"
      aria-label={t('switchLang')}
    >
      <option value="en">English</option>
      <option value="zh-CN">中文</option>
    </select>
  )
}

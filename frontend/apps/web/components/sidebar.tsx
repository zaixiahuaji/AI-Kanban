'use client'

import { LanguageSwitcher } from '@/components/language-switcher'
import { useTranslations } from 'next-intl'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { key: 'kanban', href: '/', icon: '▦' },
  { key: 'tags', href: '/tags', icon: '🏷' },
  { key: 'trash', href: '/trash', icon: '🗑' },
] as const

export function Sidebar() {
  const t = useTranslations('sidebar')
  const pathname = usePathname()
  const { data: session } = useSession()

  const handleLogout = async () => {
    if (window.confirm(t('logoutConfirm'))) {
      await signOut({ callbackUrl: '/login' })
    }
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <span className="text-lg font-semibold text-gray-900">Turbo</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span>{item.icon}</span>
              <span>{t(item.key)}</span>
            </Link>
          )
        })}

        {/* Admin link - only for staff */}
        {session?.user?.isStaff && (
          <a
            href="http://localhost:8000/admin/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <span>⚙</span>
            <span>{t('admin')}</span>
          </a>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="truncate text-sm text-gray-600">
            {session?.user?.username}
          </span>
          <LanguageSwitcher />
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          {t('logout')}
        </button>
      </div>
    </aside>
  )
}

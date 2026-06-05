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
  { key: 'statistics', href: '/statistics', icon: '📊' },
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
      <div className="flex h-14 items-center gap-3 border-b border-gray-200 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white">
          T
        </div>
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

        {/* 账户导航 */}
        <div className="mt-2 border-t border-gray-100 pt-2">
            <Link
              href="/profile"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname === '/profile'
                  ? 'bg-gray-100 font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span>{t('profile')}</span>
            </Link>
            <Link
              href="/change-password"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname === '/change-password'
                  ? 'bg-gray-100 font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </span>
              <span>{t('changePassword')}</span>
            </Link>
          </div>
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

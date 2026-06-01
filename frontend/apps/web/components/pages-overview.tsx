'use client'

import { signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function SignInLink() {
  const t = useTranslations('home')

  return (
    <button
      type="button"
      onClick={() => signIn()}
      className="cursor-pointer text-purple-600 underline"
    >
      {t('login')}
    </button>
  )
}

export function SignOutLink() {
  const t = useTranslations('home')

  return (
    <button
      type="button"
      onClick={() => signOut()}
      className="cursor-pointer text-purple-600 underline"
    >
      {t('logout')}
    </button>
  )
}

export function PagesOverview() {
  const t = useTranslations('home')

  return (
    <ul className="flex flex-col gap-6">
      <li className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <span className="w-40 font-medium">{t('authenticatedPages')}</span>

        <ul className="flex flex-row gap-6">
          <li>
            <Link href="/profile" className="text-purple-600 underline">
              {t('profile')}
            </Link>
          </li>

          <li>
            <Link href="/change-password" className="text-purple-600 underline">
              {t('changePassword')}
            </Link>
          </li>

          <li>
            <Link href="/delete-account" className="text-purple-600 underline">
              {t('deleteAccount')}
            </Link>
          </li>
        </ul>
      </li>

      <li className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <span className="w-40 font-medium">{t('anonymousPages')}</span>

        <ul className="flex flex-row gap-6">
          <li>
            <SignInLink />
          </li>

          <li>
            <a href="/register" className="text-purple-600 underline">
              {t('register')}
            </a>
          </li>

          <li>
            <SignOutLink />
          </li>
        </ul>
      </li>
    </ul>
  )
}

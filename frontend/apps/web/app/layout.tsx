import { LanguageSwitcher } from '@/components/language-switcher'
import { AuthProvider } from '@/providers/auth-provider'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { twMerge } from 'tailwind-merge'

import '@frontend/ui/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Turbo - Django & Next.js Bootstrap Template',
}

export default async function RootLayout({
  children,
}: { children: React.ReactNode }) {
  const messages = await getMessages()

  return (
    <html lang="en">
      <body
        className={twMerge(
          'bg-gray-50 text-sm text-gray-700 antialiased',
          inter.className,
        )}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <div className="px-6">
              <div className="container mx-auto my-12 max-w-6xl">
                <div className="mb-4 flex justify-end">
                  <LanguageSwitcher />
                </div>
                {children}
              </div>
            </div>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

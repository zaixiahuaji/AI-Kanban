import { AuthProvider } from '@/providers/auth-provider'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

import '@frontend/ui/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Turbo - Kanban',
}

export default async function RootLayout({
  children,
}: { children: React.ReactNode }) {
  const messages = await getMessages()

  return (
    <html lang="en">
      <body className={`${inter.className} text-sm text-gray-700 antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

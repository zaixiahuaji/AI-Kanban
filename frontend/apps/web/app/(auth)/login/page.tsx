import { LoginForm } from '@/components/forms/login-form'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login')
  return { title: `${t('title')} - Turbo` }
}

export default function Login() {
  return <LoginForm />
}

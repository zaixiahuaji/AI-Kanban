import { registerAction } from '@/actions/register-action'
import { RegisterForm } from '@/components/forms/register-form'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.register')
  return { title: `${t('title')} - Turbo` }
}

export default function Register() {
  return <RegisterForm onSubmitHandler={registerAction} />
}

'use client'

import { loginFormSchema } from '@/lib/validation'
import { FormFooter } from '@frontend/ui/forms/form-footer'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { ErrorMessage } from '@frontend/ui/messages/error-message'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

type LoginFormSchema = z.infer<typeof loginFormSchema>

export function LoginForm() {
  const search = useSearchParams()
  const t = useTranslations('auth.login')

  const { register, handleSubmit, formState } = useForm<LoginFormSchema>({
    resolver: zodResolver(loginFormSchema)
  })

  const onSubmitHandler = handleSubmit((data) => {
    signIn('credentials', {
      username: data.username,
      password: data.password,
      callbackUrl: '/'
    })
  })

  return (
    <>
      <FormHeader
        title={t('title')}
        description={t('description')}
      />

      {search.has('error') && search.get('error') === 'CredentialsSignin' && (
        <ErrorMessage>{t('errorCredentials')}</ErrorMessage>
      )}

      <form
        method="post"
        action="/api/auth/callback/credentials"
        onSubmit={onSubmitHandler}
      >
        <TextField
          type="text"
          register={register('username')}
          formState={formState}
          label={t('username')}
          placeholder={t('usernamePlaceholder')}
        />

        <TextField
          type="password"
          register={register('password', { required: true })}
          formState={formState}
          label={t('password')}
          placeholder={t('passwordPlaceholder')}
        />

        <SubmitField>{t('submit')}</SubmitField>
      </form>

      <FormFooter
        cta={t('footerCta')}
        link="/register"
        title={t('footerLink')}
      />
    </>
  )
}

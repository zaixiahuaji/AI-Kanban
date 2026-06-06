'use client'

import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { ErrorMessage } from '@frontend/ui/messages/error-message'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'

interface LoginFormValues {
  username: string
  password: string
}

export function AdminLoginForm() {
  const search = useSearchParams()
  const t = useTranslations('admin.login')

  const { register, handleSubmit, formState } = useForm<LoginFormValues>({
    defaultValues: { username: '', password: '' }
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
    </>
  )
}

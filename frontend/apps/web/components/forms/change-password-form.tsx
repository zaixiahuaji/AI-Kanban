'use client'

import type { changePasswordAction } from '@/actions/change-password-action'
import { fieldApiError } from '@/lib/forms'
import { changePasswordFormSchema } from '@/lib/validation'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { SuccessMessage } from '@frontend/ui/messages/success-message'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

export type ChangePasswordFormSchema = z.infer<typeof changePasswordFormSchema>

export function ChangePaswordForm({
  onSubmitHandler
}: {
  onSubmitHandler: typeof changePasswordAction
}) {
  const [success, setSuccess] = useState<boolean>(false)
  const t = useTranslations('account.changePassword')

  const { formState, handleSubmit, register, reset, setError } =
    useForm<ChangePasswordFormSchema>({
      resolver: zodResolver(changePasswordFormSchema)
    })

  return (
    <>
      <FormHeader
        title={t('title')}
        description={t('description')}
      />

      {success && (
        <SuccessMessage>{t('success')}</SuccessMessage>
      )}

      <form
        method="post"
        onSubmit={handleSubmit(async (data) => {
          const res = await onSubmitHandler(data)

          if (res !== true && typeof res !== 'boolean') {
            setSuccess(false)
            fieldApiError('password', 'password', res, setError)
            fieldApiError('password_new', 'passwordNew', res, setError)
            fieldApiError('password_retype', 'passwordRetype', res, setError)
          } else {
            reset()
            setSuccess(true)
          }
        })}
      >
        <TextField
          type="text"
          register={register('password')}
          label={t('password')}
          formState={formState}
        />

        <TextField
          type="text"
          register={register('passwordNew')}
          label={t('passwordNew')}
          formState={formState}
        />

        <TextField
          type="text"
          register={register('passwordRetype')}
          label={t('passwordRetype')}
          formState={formState}
        />

        <SubmitField isLoading={formState.isLoading}>
          {t('submit')}
        </SubmitField>
      </form>
    </>
  )
}

'use client'

import type { profileAction } from '@/actions/profile-action'
import { fieldApiError } from '@/lib/forms'
import { profileFormSchema } from '@/lib/validation'
import type { UserCurrent } from '@frontend/types/api'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { SuccessMessage } from '@frontend/ui/messages/success-message'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import type { z } from 'zod'

export type ProfileFormSchema = z.infer<typeof profileFormSchema>

export function ProfileForm({
  currentUser,
  onSubmitHandler
}: {
  currentUser: Promise<UserCurrent>
  onSubmitHandler: typeof profileAction
}) {
  const [success, setSuccess] = useState<boolean>(false)
  const t = useTranslations('account.profile')

  const { formState, handleSubmit, register, setError } =
    useForm<ProfileFormSchema>({
      resolver: zodResolver(profileFormSchema),
      defaultValues: async () => {
        const user = await currentUser

        return {
          firstName: user.first_name || '',
          lastName: user.last_name || ''
        }
      }
    })

  return (
    <>
      <FormHeader
        title={t('title')}
        description={t('description')}
      />

      <form
        method="post"
        onSubmit={handleSubmit(async (data) => {
          const res = await onSubmitHandler(data)

          if (res !== true && typeof res !== 'boolean') {
            setSuccess(false)

            fieldApiError('first_name', 'firstName', res, setError)
            fieldApiError('last_name', 'lastName', res, setError)
          } else {
            setSuccess(true)
          }
        })}
      >
        {success && (
          <SuccessMessage>{t('success')}</SuccessMessage>
        )}

        <TextField
          type="text"
          register={register('firstName')}
          label={t('firstName')}
          formState={formState}
        />

        <TextField
          type="text"
          register={register('lastName')}
          label={t('lastName')}
          formState={formState}
        />

        <SubmitField isLoading={formState.isLoading}>
          {t('submit')}
        </SubmitField>
      </form>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <Link
          href="/delete-account"
          className="text-sm font-medium text-red-600 transition-colors hover:text-red-700"
        >
          {t('deleteAccount')}
        </Link>
      </div>
    </>
  )
}

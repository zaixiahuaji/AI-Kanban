'use client'

import type {
  DeleteAccountFormSchema,
  deleteAccountAction
} from '@/actions/delete-account-action'
import { deleteAccountFormSchema } from '@/lib/validation'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { zodResolver } from '@hookform/resolvers/zod'
import { signOut, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

export function DeleteAccountForm({
  onSubmitHandler
}: { onSubmitHandler: typeof deleteAccountAction }) {
  const session = useSession()
  const t = useTranslations('account.deleteAccount')

  const { formState, handleSubmit, register, reset, setValue } =
    useForm<DeleteAccountFormSchema>({
      resolver: zodResolver(deleteAccountFormSchema)
    })

  useEffect(() => {
    if (session.data?.user.username) {
      setValue('usernameCurrent', session.data?.user.username)
    }
  }, [setValue, session.data?.user.username])

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

          if (res) {
            reset()
            signOut()
          }
        })}
      >
        <TextField
          type="text"
          register={register('username')}
          label={t('username')}
          formState={formState}
        />

        <SubmitField>{t('submit')}</SubmitField>
      </form>
    </>
  )
}

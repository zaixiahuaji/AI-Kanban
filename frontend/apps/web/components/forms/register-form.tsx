'use client'

import type {
  RegisterFormSchema,
  registerAction
} from '@/actions/register-action'
import { sendCodeAction } from '@/actions/send-code-action'
import { fieldApiError } from '@/lib/forms'
import { registerFormSchema } from '@/lib/validation'
import { FormFooter } from '@frontend/ui/forms/form-footer'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { signIn } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

export function RegisterForm({
  onSubmitHandler
}: { onSubmitHandler: typeof registerAction }) {
  const t = useTranslations('auth.register')
  const { formState, handleSubmit, register, setError, watch, getValues } =
    useForm<RegisterFormSchema>({
      resolver: zodResolver(registerFormSchema)
    })

  const [countdown, setCountdown] = useState(0)
  const [sendCodeMessage, setSendCodeMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const emailValue = watch('email')

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSendCode = async () => {
    const email = getValues('email')
    if (!email) return

    setSendCodeMessage(null)
    const result = await sendCodeAction(email)
    if (result.success) {
      setCountdown(60)
      setSendCodeMessage({ type: 'success', text: t('codeSent') })
    } else {
      setSendCodeMessage({ type: 'error', text: t('codeSentError') })
    }
  }

  return (
    <>
      <FormHeader title={t('title')} description={t('description')} />
      <form
        method="post"
        onSubmit={handleSubmit(async (data) => {
          const res = await onSubmitHandler(data)
          if (res === true) {
            signIn()
          } else if (typeof res !== 'boolean') {
            fieldApiError('username', 'username', res, setError)
            fieldApiError('email', 'email', res, setError)
            fieldApiError('password', 'password', res, setError)
            fieldApiError('password_retype', 'passwordRetype', res, setError)
            fieldApiError('code', 'code', res, setError)
          }
        })}
      >
        <TextField
          type="text"
          register={register('username')}
          formState={formState}
          label={t('username')}
          placeholder={t('usernamePlaceholder')}
        />
        <TextField
          type="text"
          register={register('email')}
          formState={formState}
          label={t('email')}
          placeholder={t('emailPlaceholder')}
        />
        <div className="mb-6 flex items-end gap-2">
          <div className="flex-1">
            <TextField
              type="text"
              register={register('code')}
              formState={formState}
              label={t('code')}
              placeholder={t('codePlaceholder')}
            />
          </div>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={countdown > 0 || !emailValue}
            className="h-10 rounded bg-gray-100 px-4 text-sm font-medium text-gray-700 outline outline-1 outline-gray-900/10 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {countdown > 0
              ? t('resendCode', { seconds: countdown })
              : t('sendCode')}
          </button>
        </div>
        {sendCodeMessage && (
          <p
            className={`mb-4 text-sm ${
              sendCodeMessage.type === 'success'
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {sendCodeMessage.text}
          </p>
        )}
        <TextField
          type="password"
          register={register('password')}
          formState={formState}
          label={t('password')}
          placeholder={t('passwordPlaceholder')}
        />
        <TextField
          type="password"
          register={register('passwordRetype')}
          formState={formState}
          label={t('passwordRetype')}
          placeholder={t('passwordRetypePlaceholder')}
        />
        <SubmitField>{t('submit')}</SubmitField>
      </form>
      <FormFooter
        cta={t('footerCta')}
        link="/login"
        title={t('footerLink')}
      />
    </>
  )
}

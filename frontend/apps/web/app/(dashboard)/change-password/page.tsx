import { changePasswordAction } from '@/actions/change-password-action'
import { ChangePaswordForm } from '@/components/forms/change-password-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Change password - Turbo'
}

export default function ChangePassword() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <ChangePaswordForm onSubmitHandler={changePasswordAction} />
      </div>
    </div>
  )
}

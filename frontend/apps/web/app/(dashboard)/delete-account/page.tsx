import { deleteAccountAction } from '@/actions/delete-account-action'
import { DeleteAccountForm } from '@/components/forms/delete-account-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Delete account - Turbo'
}

export default function DeleteAccount() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <DeleteAccountForm onSubmitHandler={deleteAccountAction} />
      </div>
    </div>
  )
}

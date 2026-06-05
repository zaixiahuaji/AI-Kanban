import { profileAction } from '@/actions/profile-action'
import { ProfileForm } from '@/components/forms/profile-form'
import { getApiClient } from '@/lib/api'
import { authOptions } from '@/lib/auth'
import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'

export const metadata: Metadata = {
  title: 'Profile - Turbo'
}

export default async function Profile() {
  const session = await getServerSession(authOptions)
  const apiClient = await getApiClient(session)

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <ProfileForm
          currentUser={apiClient.users.usersMeRetrieve()}
          onSubmitHandler={profileAction}
        />
      </div>
    </div>
  )
}

import { AdminLoginForm } from '@/components/admin-login-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Login - Turbo',
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <AdminLoginForm />
      </div>
    </div>
  )
}

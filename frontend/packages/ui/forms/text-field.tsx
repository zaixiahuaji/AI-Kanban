'use client'

import type React from 'react'
import type {
  FieldValues,
  FormState,
  UseFormRegisterReturn
} from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

export function TextField({
  type,
  label,
  placeholder,
  register,
  formState
}: {
  type: 'text' | 'password' | 'number'
  label: string
  placeholder?: string
  register: UseFormRegisterReturn
  formState: FormState<FieldValues>
}): React.ReactElement {
  const hasError = formState.errors[register.name]

  return (
    <label className="mb-5 flex flex-col last:mb-0">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>

      <input
        type={type}
        placeholder={placeholder}
        className={twMerge(
          'block h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300',
          hasError && 'border-red-500 focus:border-red-500 focus:ring-red-200'
        )}
        {...register}
      />

      {hasError && (
        <div className="mt-1.5 text-sm text-red-600">
          {formState.errors[register.name]?.message?.toString()}
        </div>
      )}
    </label>
  )
}

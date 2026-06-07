'use client'

import { useTranslations } from 'next-intl'

interface AIInputProps {
  onSend: (content: string) => void
  disabled: boolean
  remaining: number
}

export function AIInput({ onSend, disabled, remaining }: AIInputProps) {
  const t = useTranslations('ai')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const input = form.elements.namedItem('message') as HTMLInputElement
    const value = input.value.trim()
    if (!value || disabled) return
    onSend(value)
    input.value = ''
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-2">
        <input
          name="message"
          type="text"
          placeholder={t('inputPlaceholder')}
          disabled={disabled}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-gray-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {t('send')}
        </button>
      </form>
      <div className="px-3 pb-2 text-center text-[10px] text-gray-400">
        {t('remaining', { count: remaining })}
      </div>
    </div>
  )
}

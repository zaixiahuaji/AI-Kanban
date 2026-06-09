'use client'

import { useCallback, useRef } from 'react'
import { Mic } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useSpeechRecognition } from '@/lib/use-speech-recognition'

interface AIInputProps {
  onSend: (content: string) => void
  disabled: boolean
  remaining: number
}

export function AIInput({ onSend, disabled, remaining }: AIInputProps) {
  const t = useTranslations('ai')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInterimResult = useCallback((text: string) => {
    if (inputRef.current) {
      inputRef.current.value = text
    }
  }, [])

  const handleFinalResult = useCallback((text: string) => {
    if (inputRef.current) {
      inputRef.current.value = text
      inputRef.current.focus()
    }
  }, [])

  const { isListening, isSupported, toggle } = useSpeechRecognition({
    onInterimResult: handleInterimResult,
    onFinalResult: handleFinalResult,
  })

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
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
        {/* 麦克风按钮 */}
        {isSupported && (
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border transition-all ${
              isListening
                ? 'animate-pulse border-red-300 bg-red-50 text-red-500'
                : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            } disabled:opacity-50`}
            aria-label={isListening ? t('listening') : t('inputPlaceholder')}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        <input
          ref={inputRef}
          name="message"
          type="text"
          placeholder={isListening ? t('listening') : t('inputPlaceholder')}
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

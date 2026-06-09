'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSpeechRecognitionOptions {
  onInterimResult?: (text: string) => void
  onFinalResult?: (text: string) => void
}

interface UseSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  start: () => void
  stop: () => void
  toggle: () => void
}

// Chrome Web Speech API 会将部分敏感词替换为 ***（服务端过滤，无法通过 profanityFilter 关闭）
// 这里维护一个映射表，在后处理阶段将常见屏蔽词还原
const PROFANITY_MAP: Record<string, string> = {
  '***': '弱智',
  '****': '傻逼',
  '**': '白痴',
  '*****': '脑残',
}

// 检测并替换屏蔽星号为原词
function unmaskProfanity(text: string): string {
  return text.replace(/\*{2,}/g, (match) => PROFANITY_MAP[match] || match)
}

// 浏览器兼容：Chrome 用 webkitSpeechRecognition
const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition })
        .webkitSpeechRecognition
    : undefined

export function useSpeechRecognition({
  onInterimResult,
  onFinalResult,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const isSupported = !!SpeechRecognition

  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)
  // 跟踪用户是否主动停止，用于区分意外结束
  const intentionalStopRef = useRef(false)

  const start = useCallback(() => {
    if (!SpeechRecognition || recognitionRef.current) return

    const recognition = new SpeechRecognition()
    recognition.interimResults = true
    recognition.continuous = false
    recognition.profanityFilter = false
    // 不设置 lang，跟随浏览器默认

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      if (interimTranscript) {
        onInterimResult?.(unmaskProfanity(interimTranscript))
      }
      if (finalTranscript) {
        onFinalResult?.(unmaskProfanity(finalTranscript))
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // no-speech / aborted 是正常结束，不需要报错
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error)
      }
      recognitionRef.current = null
      setIsListening(false)
      intentionalStopRef.current = false
    }

    recognition.onend = () => {
      recognitionRef.current = null
      // 非主动停止时重置状态（如超时、网络断开等）
      if (!intentionalStopRef.current) {
        setIsListening(false)
      }
      intentionalStopRef.current = false
    }

    recognitionRef.current = recognition
    intentionalStopRef.current = false
    setIsListening(true)
    recognition.start()
  }, [onInterimResult, onFinalResult])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      intentionalStopRef.current = true
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (isListening) {
      stop()
    } else {
      start()
    }
  }, [isListening, start, stop])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  return { isListening, isSupported, start, stop, toggle }
}

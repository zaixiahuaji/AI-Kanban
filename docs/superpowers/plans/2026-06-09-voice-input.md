# AI 聊天语音输入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 聊天输入框添加浏览器原生语音识别输入，点击麦克风按钮开始/停止录音，实时转写文字到输入框。

**Architecture:** 纯前端。新建 `useSpeechRecognition` Hook 封装 Web Speech API，修改 `AIInput` 组件添加麦克风按钮并集成 Hook。无后端改动。

**Tech Stack:** Web Speech API (`SpeechRecognition`)、React Hooks、lucide-react (Mic 图标)、next-intl (翻译)

---

### Task 1: 新建 useSpeechRecognition Hook

**Files:**
- Create: `frontend/apps/web/lib/use-speech-recognition.ts`

- [ ] **Step 1: 创建 Hook 文件**

创建 `frontend/apps/web/lib/use-speech-recognition.ts`：

```typescript
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
        onInterimResult?.(interimTranscript)
      }
      if (finalTranscript) {
        onFinalResult?.(finalTranscript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/lib/use-speech-recognition.ts
git commit -m "feat: 新建 useSpeechRecognition Hook 封装 Web Speech API"
```

---

### Task 2: 添加翻译键

**Files:**
- Modify: `frontend/packages/ui/locales/en.json` (ai 部分)
- Modify: `frontend/packages/ui/locales/zh-CN.json` (ai 部分)

- [ ] **Step 1: 在英文翻译文件中添加语音相关键**

在 `frontend/packages/ui/locales/en.json` 的 `"ai"` 对象中，在 `"clearHistoryConfirm"` 后面添加：

```json
"listening": "Listening...",
"micNotSupported": "Voice input is not supported in this browser",
"micError": "Voice recognition error, please try again"
```

- [ ] **Step 2: 在中文翻译文件中添加对应键**

在 `frontend/packages/ui/locales/zh-CN.json` 的 `"ai"` 对象中，在 `"clearHistoryConfirm"` 后面添加：

```json
"listening": "正在聆听...",
"micNotSupported": "当前浏览器不支持语音输入",
"micError": "语音识别出错，请重试"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/packages/ui/locales/en.json frontend/packages/ui/locales/zh-CN.json
git commit -m "feat: 添加语音输入翻译键（中英文）"
```

---

### Task 3: 改造 AIInput 组件，集成语音识别

**Files:**
- Modify: `frontend/apps/web/components/ai/ai-input.tsx`

- [ ] **Step 1: 重写 AIInput 组件**

将 `frontend/apps/web/components/ai/ai-input.tsx` 完整替换为：

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/components/ai/ai-input.tsx
git commit -m "feat: AI 输入框集成语音识别麦克风按钮"
```

---

### Task 4: 验证功能

- [ ] **Step 1: 启动前端开发服务器**

```bash
cd frontend && pnpm --filter web dev
```

- [ ] **Step 2: 在浏览器中验证**

1. 打开看板页面，展开 AI 面板
2. 确认输入框左侧出现麦克风按钮（Chrome/Edge）
3. 点击麦克风，确认按钮变为红色脉冲动画
4. 说话，确认输入框实时显示识别文字
5. 再次点击麦克风停止，确认文字保留在输入框可编辑
6. 点击发送，确认消息正常发送
7. 不录音时文字输入和发送正常工作

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat: AI 语音输入功能完成"
```

'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cancelAction, clearChatHistory, confirmAction, getChatHistory, getUsage, undoAction } from '@/actions/ai-actions'
import { getSession } from 'next-auth/react'
import type { AIAction as AIActionType, ChatMessage, DailyUsage } from '@/lib/ai-types'
import { streamChat } from '@/lib/ai-sse'

import { AIInput } from './ai-input'
import { MessageList } from './message-list'

export function AIAssistantPanel() {
  const t = useTranslations('ai')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [usage, setUsage] = useState<DailyUsage>({ enabled: false, used: 0, limit: 50, remaining: 50 })
  const [isStreaming, setIsStreaming] = useState(false)
  const idCounter = useRef(0)
  const nextId = (prefix: string) => `${prefix}-${++idCounter.current}`
  // ref 同步跟踪文本和操作，避免嵌套状态更新
  const streamTextRef = useRef('')
  const pendingActions = useRef<AIActionType[]>([])

  // 加载历史和额度
  useEffect(() => {
    getChatHistory().then((res) => {
      if (res.success && res.data) {
        setMessages(res.data.messages)
      }
    })
    getUsage().then((res) => {
      if (res.success && res.data) {
        setUsage(res.data)
      }
    })
  }, [])

  // 更新本地消息中的 action 状态
  const updateActionInMessages = useCallback(
    (actionId: string, updates: Partial<AIActionType>) => {
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          actions: msg.actions.map((a) =>
            a.id === actionId ? { ...a, ...updates } : a,
          ),
        })),
      )
    },
    [],
  )

  const handleSend = useCallback(
    async (content: string) => {
      if (isStreaming) return

      // 先添加用户消息到列表
      const tempUserMsg: ChatMessage = {
        id: nextId('temp'),
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        actions: [],
      }
      setMessages((prev) => [...prev, tempUserMsg])
      setIsStreaming(true)
      setStreamingText('')
      streamTextRef.current = ''
      pendingActions.current = []

      // 获取 token 用于 SSE
      const session = await getSession()
      const token = (session as { accessToken?: string })?.accessToken || ''

      streamChat(
        content,
        token,
        (event) => {
          switch (event.type) {
            case 'text':
              // ref 即时累积，state 同步渲染
              streamTextRef.current += event.content
              setStreamingText(streamTextRef.current)
              break
            case 'action': {
              // 只累积操作，不创建消息
              pendingActions.current.push({
                id: event.action_id,
                tool_name: event.tool_name,
                tool_args: event.tool_args,
                status: event.status,
                result: event.result,
                created_at: new Date().toISOString(),
              })
              break
            }
            case 'error':
              // 错误消息立即显示
              streamTextRef.current = ''
              setStreamingText('')
              setMessages((prev) => [
                ...prev,
                {
                  id: nextId('error'),
                  role: 'assistant',
                  content: `⚠️ ${event.content}`,
                  created_at: new Date().toISOString(),
                  actions: [],
                },
              ])
              break
            case 'done': {
              // 从 ref 读取完整文本，同一层级更新两个 state
              const finalText = streamTextRef.current
              const actions = [...pendingActions.current]
              streamTextRef.current = ''
              pendingActions.current = []

              if (finalText || actions.length > 0) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: nextId('assistant'),
                    role: 'assistant',
                    content: finalText || '',
                    created_at: new Date().toISOString(),
                    actions,
                  },
                ])
              }
              // 同一渲染周期清空 streamingText
              setStreamingText('')
              setIsStreaming(false)
              // 刷新额度
              getUsage().then((res) => {
                if (res.success && res.data) setUsage(res.data)
              })
              // 刷新看板
              window.dispatchEvent(new CustomEvent('ai-action-done'))
              break
            }
          }
        },
      )
    },
    [isStreaming],
  )

  const handleConfirm = useCallback(async (actionId: string) => {
    const res = await confirmAction(actionId)
    if (res.success && res.data) {
      updateActionInMessages(actionId, {
        status: 'confirmed',
        result: res.data.result,
      })
      window.dispatchEvent(new CustomEvent('ai-action-done'))
    }
  }, [updateActionInMessages])

  const handleCancel = useCallback(async (actionId: string) => {
    const res = await cancelAction(actionId)
    if (res.success) {
      updateActionInMessages(actionId, { status: 'cancelled' })
    }
  }, [updateActionInMessages])

  const handleUndo = useCallback(async (actionId: string) => {
    const res = await undoAction(actionId)
    if (res.success) {
      updateActionInMessages(actionId, { status: 'undone' })
      window.dispatchEvent(new CustomEvent('ai-action-done'))
    }
  }, [updateActionInMessages])

  const handleClearHistory = useCallback(async () => {
    const res = await clearChatHistory()
    if (res.success) {
      setMessages([])
      getUsage().then((r) => {
        if (r.success && r.data) setUsage(r.data)
      })
    }
  }, [])

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
        <span className="text-sm font-medium text-gray-900">✨ {t('title')}</span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('clearHistoryConfirm'))) {
                handleClearHistory()
              }
            }}
            className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            {t('clearHistory')}
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <MessageList
        messages={messages}
        streamingText={streamingText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onUndo={handleUndo}
      />

      {/* 输入区域 */}
      <div className="border-t border-gray-100">
        <AIInput
          onSend={handleSend}
          disabled={isStreaming}
          remaining={usage.remaining}
          limitEnabled={usage.enabled}
        />
      </div>
    </div>
  )
}

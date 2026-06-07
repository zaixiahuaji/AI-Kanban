'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { cancelAction, confirmAction, getChatHistory, getUsage, undoAction } from '@/actions/ai-actions'
import { getSession } from 'next-auth/react'
import type { AIAction as AIActionType, ChatMessage, DailyUsage } from '@/lib/ai-types'
import { streamChat } from '@/lib/ai-sse'

import { AIInput } from './ai-input'
import { MessageList } from './message-list'

export function AIAssistantPanel() {
  const t = useTranslations('ai')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [usage, setUsage] = useState<DailyUsage>({ used: 0, limit: 50, remaining: 50 })
  const [isStreaming, setIsStreaming] = useState(false)

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
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        actions: [],
      }
      setMessages((prev) => [...prev, tempUserMsg])
      setIsStreaming(true)
      setStreamingText('')

      // 获取 token 用于 SSE
      const session = await getSession()
      const token = (session as { accessToken?: string })?.accessToken || ''

      streamChat(
        content,
        token,
        (event) => {
          switch (event.type) {
            case 'text':
              setStreamingText((prev) => prev + event.content)
              break
            case 'action': {
              const tempAssistantId = `temp-assistant-${Date.now()}`
              const newAction: AIActionType = {
                id: event.action_id,
                tool_name: event.tool_name,
                tool_args: event.tool_args,
                status: event.status,
                result: event.result,
                created_at: new Date().toISOString(),
              }
              // 将 streaming text 保存为 assistant 消息
              setStreamingText((currentText) => {
                const assistantMsg: ChatMessage = {
                  id: tempAssistantId,
                  role: 'assistant',
                  content: currentText,
                  created_at: new Date().toISOString(),
                  actions: [newAction],
                }
                setMessages((prev) => [...prev, assistantMsg])
                return '' // 清空 streaming
                })
              break
            }
            case 'error':
              setStreamingText((currentText) => {
                const errorMsg: ChatMessage = {
                  id: `error-${Date.now()}`,
                  role: 'assistant',
                  content: `⚠️ ${event.content}`,
                  created_at: new Date().toISOString(),
                  actions: [],
                }
                setMessages((prev) => [...prev, errorMsg])
                return ''
              })
              break
            case 'done':
              // 如果还有未保存的 streaming text
              setStreamingText((currentText) => {
                if (currentText) {
                  const assistantMsg: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: currentText,
                    created_at: new Date().toISOString(),
                    actions: [],
                  }
                  setMessages((prev) => [...prev, assistantMsg])
                }
                return ''
              })
              setIsStreaming(false)
              // 刷新额度
              getUsage().then((res) => {
                if (res.success && res.data) setUsage(res.data)
              })
              // 刷新看板（通过触发 router refresh）
              window.dispatchEvent(new CustomEvent('ai-action-done'))
              break
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

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
        <span className="text-sm font-medium text-gray-900">✨ {t('title')}</span>
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
        />
      </div>
    </div>
  )
}

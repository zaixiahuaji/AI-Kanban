'use client'

import { useEffect, useRef } from 'react'

import type { ChatMessage } from '@/lib/ai-types'

import { ActionCard } from './action-card'
import { MessageBubble } from './message-bubble'

interface MessageListProps {
  messages: ChatMessage[]
  streamingText: string
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onUndo: (id: string) => void
}

export function MessageList({
  messages,
  streamingText,
  onConfirm,
  onCancel,
  onUndo,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      <div className="flex flex-col gap-2">
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble role={msg.role} content={msg.content} />
            {msg.actions.map((action) => (
              <div key={action.id} className="mt-1">
                <ActionCard
                  action={action}
                  onConfirm={onConfirm}
                  onCancel={onCancel}
                  onUndo={onUndo}
                />
              </div>
            ))}
          </div>
        ))}
        {streamingText && (
          <MessageBubble role="assistant" content={streamingText} />
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}

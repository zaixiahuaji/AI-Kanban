// SSE 事件类型
export interface SSETextEvent {
  type: 'text'
  content: string
}

export interface SSEActionEvent {
  type: 'action'
  action_id: string
  tool_name: string
  tool_args: Record<string, unknown>
  status: 'pending' | 'executed' | 'confirmed' | 'cancelled' | 'undone'
  result: Record<string, unknown> | null
}

export interface SSEDoneEvent {
  type: 'done'
}

export interface SSEErrorEvent {
  type: 'error'
  content: string
}

export type SSEEvent =
  | SSETextEvent
  | SSEActionEvent
  | SSEDoneEvent
  | SSEErrorEvent

// 聊天消息
export interface AIAction {
  id: string
  tool_name: string
  tool_args: Record<string, unknown>
  status: 'pending' | 'executed' | 'confirmed' | 'cancelled' | 'undone'
  result: Record<string, unknown> | null
  created_at: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  actions: AIAction[]
}

// 额度
export interface DailyUsage {
  used: number
  limit: number
  remaining: number
}

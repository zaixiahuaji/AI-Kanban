import type { SSEEvent } from './ai-types'

/**
 * 发送聊天消息并解析 SSE 流。
 * onEvent: 每解析到一个事件就回调。
 * 返回一个 abort controller 供外部取消。
 */
export function streamChat(
  content: string,
  token: string,
  onEvent: (event: SSEEvent) => void,
): AbortController {
  const controller = new AbortController()

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
  const url = `${baseUrl}/api/ai/chat/`

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 429) {
          onEvent({ type: 'error', content: '今日额度已用完，明天再来' })
        } else {
          onEvent({ type: 'error', content: 'AI 服务暂时不可用' })
        }
        onEvent({ type: 'done' })
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onEvent({ type: 'error', content: '连接失败' })
        onEvent({ type: 'done' })
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 解析 SSE 事件：event: message\ndata: {...}\n\n
        const parts = buffer.split('\n\n')
        // 最后一部分可能不完整，保留在 buffer 中
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n')
          let dataLine = ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              dataLine = line.slice(6)
            }
          }
          if (dataLine) {
            try {
              const event = JSON.parse(dataLine) as SSEEvent
              onEvent(event)
            } catch {
              // 忽略解析失败
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', content: '网络连接失败' })
        onEvent({ type: 'done' })
      }
    })

  return controller
}

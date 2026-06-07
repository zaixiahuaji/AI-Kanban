# Phase 6: AI 看板助手 — 设计文档

> **状态**: 待审核
> **日期**: 2026-06-07

---

## 1. 概述

在看板页面右侧添加 AI 助手面板，用户通过自然语言与 AI 对话来管理看板任务。AI 通过 Function Calling 调用预定义工具完成操作，Django 后端全权负责 LLM 调用和业务逻辑，通过 SSE 流式返回结果。

**核心原则**: 操作可逆 > 操作完美。破坏性操作需用户确认，所有操作支持单步撤销。

---

## 2. 技术选型

| 项目 | 选择 | 理由 |
|---|---|---|
| LLM | DeepSeek V4 Pro | OpenAI 兼容 API，国内直连，性价比高 |
| SDK | `openai` Python 包 | DeepSeek 兼容 OpenAI 接口，Function Calling 支持完善 |
| SSE | Django `StreamingHttpResponse` | 无额外依赖，当前规模够用 |
| 前端 | `fetch` + `ReadableStream` | 比 `EventSource` 更灵活（支持 POST body） |

---

## 3. 数据模型

### 3.1 ChatMessage — 聊天记录

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| user | FK(User, CASCADE) | 所属用户 |
| role | CharField(10) | `user` / `assistant` |
| content | TextField | 消息文本内容 |
| created_at | DateTimeField | auto_now_add，用于排序 |

约束: 每用户最多保留 200 条记录，超出后删除最早的。清理在每次保存新消息时触发。

### 3.2 AIAction — AI 操作记录

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| message | FK(ChatMessage, CASCADE) | 关联的 AI 回复消息 |
| tool_name | CharField(50) | 如 `create_task`, `move_task` |
| tool_args | JSONField | 工具调用参数 |
| status | CharField(10) | `pending` / `executed` / `confirmed` / `cancelled` / `undone` |
| result | JSONField(null=True) | 执行结果（成功/失败/返回数据） |
| created_at | DateTimeField | auto_now_add |

### 3.3 DailyUsage — 每日额度

| 字段 | 类型 | 说明 |
|---|---|---|
| user | FK(User, CASCADE) | |
| date | DateField | |
| count | IntegerField(default=0) | 当日已用条数 |

约束: `UniqueConstraint(user, date)`。每日上限 50 条。

---

## 4. API 端点

所有端点需要 `IsAuthenticated` 权限。

### 4.1 `POST /api/ai/chat/` — SSE 流式聊天

**请求体:**
```json
{ "content": "把修复bug移到进行中" }
```

**响应:** `text/event-stream` SSE 流

```
event: message
data: {"type": "text", "content": "好的，我来帮你移动任务。"}

event: message
data: {"type": "action", "action_id": "uuid", "tool_name": "move_task", "tool_args": {...}, "status": "executed", "result": {...}}

event: message
data: {"type": "done"}
```

**处理流程:**
1. 检查每日额度（`DailyUsage`），超限返回 429
2. 保存用户消息到 `ChatMessage`
3. 构建上下文: 看板摘要 + 最近 20 条聊天历史 + system prompt
4. 调用 DeepSeek `stream=True`，逐 chunk 下发 `type:text`
5. 如 AI 返回 `function_call`:
   - 执行对应工具 handler
   - 保存 `AIAction` 记录
   - 下发 `type:action` 事件
   - 将工具结果回传 DeepSeek 继续对话（最多 5 轮）
6. AI 回复结束，保存 assistant 消息到 `ChatMessage`
7. 下发 `type:done`

### 4.2 `GET /api/ai/chat/` — 获取聊天历史

返回当前用户最近 20 条消息（含关联的 AIAction）。

**响应:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "创建一个高优先级任务",
      "created_at": "2026-06-07T10:00:00Z",
      "actions": []
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "已创建任务「新任务」，优先级为高。",
      "created_at": "2026-06-07T10:00:02Z",
      "actions": [
        {
          "id": "uuid",
          "tool_name": "create_task",
          "tool_args": {"title": "新任务", "priority": "high"},
          "status": "executed",
          "result": {"task_id": "uuid", "title": "新任务"}
        }
      ]
    }
  ]
}
```

### 4.3 `POST /api/ai/actions/{id}/confirm/` — 确认操作

将 `pending` 状态的 AIAction 执行，状态改为 `confirmed`。返回执行结果。

**响应:**
```json
{
  "success": true,
  "action_id": "uuid",
  "tool_name": "delete_task",
  "result": {"deleted": true}
}
```

### 4.4 `POST /api/ai/actions/{id}/cancel/` — 取消操作

将 `pending` 状态改为 `cancelled`。不执行任何操作。

**响应:**
```json
{ "success": true, "action_id": "uuid", "status": "cancelled" }
```

### 4.5 `POST /api/ai/actions/{id}/undo/` — 撤销操作

将 `executed` 或 `confirmed` 的操作回滚，状态改为 `undone`。每个操作类型有对应的 undo handler:

| 操作 | 撤销逻辑 |
|---|---|
| create_task | 软删除创建的任务 |
| move_task | 将任务移回原列（从 `AIAction.result.previous_status` 中读取原状态） |
| create_column | 删除该列 |
| delete_task | 恢复任务（is_deleted=False） |

**注意:** move_task 的 tool_args 中必须包含 `previous_status` 字段，在执行 move 时自动记录。

**响应:**
```json
{ "success": true, "action_id": "uuid", "status": "undone" }
```

### 4.6 `GET /api/ai/usage/` — 获取今日额度

**响应:**
```json
{ "used": 3, "limit": 50, "remaining": 47 }
```

---

## 5. 上下文构建

每次调用 `POST /api/ai/chat/` 时动态构建，确保数据最新。

### 5.1 System Prompt

```
你是一个看板任务管理助手。用户会通过自然语言请你帮忙管理看板上的任务。

当前看板状态:
- 列: {列名} ({任务数}个任务)
- 标签: {标签名1}, {标签名2}, ...
- 总任务数: {N}个

你可以使用工具来查询、创建、移动和删除任务和列。

规则:
- 优先使用工具完成操作，操作完成后用简短的中文回复确认
- 如果不确定用户意图，追问而不是猜测
- 不要执行用户没有明确要求的操作
- 任务操作仅限当前用户自己的任务
```

### 5.2 聊天历史

从 `ChatMessage` 取最近 20 条，按 `created_at` 排序。不包含工具调用细节（节省 token），只传角色和文本内容。

### 5.3 Token 预算

- System prompt + 看板摘要: ~500 tokens
- 每条历史消息: ~50 tokens
- 20 条历史: ~1000 tokens
- 工具定义 (10 个): ~800 tokens
- 预留输出空间: ~1500 tokens
- **总预算: ~4000 tokens/轮**，远低于 DeepSeek V4 Pro 的 context window

---

## 6. AI 工具定义

### 6.1 安全级别: 查询（直接执行，无需确认）

**list_tasks** — 查询任务列表
```json
{
  "name": "list_tasks",
  "description": "查询当前用户的任务列表，可按状态、优先级筛选",
  "parameters": {
    "status": { "type": "string", "enum": ["todo", "in_progress", "done"], "required": false },
    "priority": { "type": "string", "enum": ["high", "medium", "low"], "required": false }
  }
}
```
Handler: 调用 `Task.objects.active().filter(created_by=user)` 并返回摘要列表。

**list_columns** — 查询看板列
```json
{
  "name": "list_columns",
  "description": "获取当前用户的看板列列表，包含每列的任务数",
  "parameters": {}
}
```
Handler: 查询 `BoardColumn` 并按 `position` 排序，附带每列活跃任务计数。

### 6.2 安全级别: 自动（执行 + 通知用户）

**create_task** — 创建任务
```json
{
  "name": "create_task",
  "description": "创建一个新任务",
  "parameters": {
    "title": { "type": "string", "required": true },
    "priority": { "type": "string", "enum": ["high", "medium", "low"], "required": false },
    "status": { "type": "string", "required": false, "description": "目标列 slug，默认 todo" }
  }
}
```
Handler: 调用现有 `TaskViewSet.create` 逻辑。

**move_task** — 移动任务到其他列
```json
{
  "name": "move_task",
  "description": "将任务移动到指定列",
  "parameters": {
    "task_title": { "type": "string", "required": true, "description": "要移动的任务标题（模糊匹配）" },
    "target_column": { "type": "string", "required": true, "description": "目标列名称或 slug" }
  }
}
```
Handler: 按标题模糊查找任务，将 `previous_status` 记录到 `AIAction.result.previous_status`，更新任务 `status`。

**create_column** — 创建看板列
```json
{
  "name": "create_column",
  "description": "创建一个新的看板列",
  "parameters": {
    "name": { "type": "string", "required": true }
  }
}
```

**reorder_columns** — 重新排列列顺序
```json
{
  "name": "reorder_columns",
  "description": "按给定顺序重新排列看板列",
  "parameters": {
    "column_names": { "type": "array", "items": { "type": "string" }, "required": true, "description": "按新顺序排列的列名列表" }
  }
}
```

### 6.3 安全级别: 需确认（AI 提议，用户确认后执行）

**delete_task** — 删除任务
```json
{
  "name": "delete_task",
  "description": "删除一个任务（需用户确认）",
  "parameters": {
    "task_title": { "type": "string", "required": true }
  }
}
```
Handler: 存为 `pending` 状态，等待用户通过 `POST /api/ai/actions/{id}/confirm/` 确认。

**batch_move_tasks** — 批量移动任务
```json
{
  "name": "batch_move_tasks",
  "description": "将多个任务移动到指定列（需用户确认）",
  "parameters": {
    "task_titles": { "type": "array", "items": { "type": "string" }, "required": true },
    "target_column": { "type": "string", "required": true }
  }
}
```

**batch_delete_tasks** — 批量删除任务
```json
{
  "name": "batch_delete_tasks",
  "description": "删除多个任务（需用户确认）",
  "parameters": {
    "task_titles": { "type": "array", "items": { "type": "string" }, "required": true }
  }
}
```

**delete_column** — 删除看板列
```json
{
  "name": "delete_column",
  "description": "删除一个看板列及其中的所有任务（需用户确认）",
  "parameters": {
    "column_name": { "type": "string", "required": true }
  }
}
```

### 6.4 特殊工具

**undo_last_action** — 撤销最近操作
```json
{
  "name": "undo_last_action",
  "description": "撤销最近一次已执行的操作",
  "parameters": {}
}
```
Handler: 查找用户最近的 `executed`/`confirmed` 状态的 AIAction，调用对应 undo handler。

---

## 7. Function Calling 循环控制

```
while function_calls_remaining > 0:
    response = deepseek.chat.completions.create(messages, tools, stream=True)

    for chunk in response:
        if chunk is text → SSE type:text
        if chunk is function_call:
            result = execute_tool(function_call)
            save AIAction
            SSE type:action
            append tool_result to messages
            continue loop  # 重新调用 DeepSeek

    if no function_call in response → break

max_iterations = 5
timeout = 30s per iteration
```

超过 5 轮或 30s 超时，下发 `type:text` 告知用户操作复杂度超限，并发 `type:done` 结束。

---

## 8. 错误处理

| 场景 | 处理 | 前端展示 |
|---|---|---|
| DeepSeek API 超时 (>30s) | 中断 SSE 流 | "AI 暂时无法响应，请稍后重试" |
| DeepSeek API 返回错误 | 记录日志，不下发 | "AI 服务暂时不可用" |
| 工具参数错误（如任务不存在） | 返回错误给 AI 让它修正 | AI 自动重试或告知用户 |
| 工具执行异常（数据库错误等） | 记录日志，返回失败 | "操作失败，请稍后重试" |
| Function Calling 超过 5 轮 | 强制结束 | "操作过于复杂，请分步描述" |
| 每日额度用完 | 返回 429 | "今日额度已用完（50/50），明天再来" |
| SSE 连接断开 | 前端显示断连提示 | "连接已断开，请重新发送" |

---

## 9. 前端设计

### 9.1 面板组件结构

```
看板页面 (kanban-page-client.tsx)
  └── AI 面板切换按钮 (固定在页面右侧)
  └── AIAssistantPanel (右侧 320px 面板)
       ├── 面板头部 (标题 + 收起按钮)
       ├── 消息列表 (MessageList)
       │    ├── 用户消息气泡
       │    ├── AI 文字消息气泡
       │    └── 操作卡片 (ActionCard)
       │         ├── 已执行操作 (绿色 ✓ + 撤销按钮)
       │         └── 待确认操作 (红色 ⚠ + 确认/取消按钮)
       ├── 输入区域 (InputArea)
       │    ├── 文本输入框
       │    └── 发送按钮
       └── 额度提示 (底部小字)
```

### 9.2 交互细节

- **面板切换**: 看板页面右侧固定一个 ✨ 图标按钮，点击展开/收起面板
- **发送消息**: 回车发送，发送时禁用输入框和按钮（防止重复发送）
- **流式渲染**: AI 文字逐字出现（SSE chunk 累加），操作卡片在 `type:action` 时一次性插入
- **确认/取消**: 点击确认 → `POST /api/ai/actions/{id}/confirm/` → 卡片状态更新为已执行 → 刷新看板
- **撤销**: 点击操作卡片上的撤销按钮 → `POST /api/ai/actions/{id}/undo/` → 卡片状态更新为已撤销 → 刷新看板
- **看板刷新**: 收到 `type:done` 或操作确认/撤销后，调用 `router.refresh()` 刷新看板数据
- **加载历史**: 面板展开时 `GET /api/ai/chat/` 加载最近 20 条历史

### 9.3 样式

- 面板: 320px 固定宽度，白色背景，左侧 `border-l` 分隔线
- 用户消息: 深色背景 (`bg-gray-800`)，右对齐，圆角 `rounded-2xl rounded-br-sm`
- AI 消息: 浅色背景 (`bg-gray-100`)，左对齐，圆角 `rounded-2xl rounded-bl-sm`
- 操作卡片: 白色背景 + 边框，已执行绿色左边框，待确认红色左边框
- 输入区: 底部固定，与消息区用分割线隔开

---

## 10. 环境变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `sk-xxx` |
| `DEEPSEEK_BASE_URL` | API 基础 URL | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 模型名称 | `deepseek-chat` |
| `AI_DAILY_LIMIT` | 每日额度上限 | `50` |

添加到 `.env.backend`。

---

## 11. 依赖

### 后端新增 Python 包

- `openai` — DeepSeek API 调用（兼容 OpenAI SDK）

### 前端无新依赖

使用浏览器原生 `fetch` + `ReadableStream` 处理 SSE，无需 `eventsource` 等库。

---

## 12. 不在范围内（后续迭代）

- 文件上传作为上下文
- 语音输入
- 多步撤销（仅支持单步）
- AI 主动推送通知
- 管理端 AI 面板
- 多模型切换

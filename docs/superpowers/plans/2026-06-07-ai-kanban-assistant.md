# AI 看板助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在看板页面右侧添加 AI 助手面板，用户通过自然语言对话管理看板任务，AI 通过 Function Calling 调用预定义工具完成操作。

**Architecture:** Django 后端通过 `openai` SDK 调用 DeepSeek V4 Pro（OpenAI 兼容 API），使用 Function Calling 执行看板操作，通过 `StreamingHttpResponse` SSE 流式返回结果。前端用 `fetch` + `ReadableStream` 解析 SSE 流，实时渲染 AI 回复和操作卡片。

**Tech Stack:** DeepSeek V4 Pro + `openai` Python SDK / Django `StreamingHttpResponse` SSE / Next.js Client Components / `fetch` ReadableStream

---

## File Structure

### New files (backend)

| File | Responsibility |
|---|---|
| `backend/api/ai_serializers.py` | AI 相关序列化器（聊天消息、操作、额度） |
| `backend/api/ai_tools.py` | AI 工具 schema 定义 + handler 函数 + 分发逻辑 |
| `backend/api/ai_views.py` | AI API 视图（SSE 聊天、历史、操作确认/取消/撤销、额度） |
| `backend/api/tests/test_ai.py` | AI 功能测试（mock DeepSeek API） |

### New files (frontend)

| File | Responsibility |
|---|---|
| `frontend/apps/web/lib/ai-types.ts` | AI 消息、操作、额度的 TypeScript 类型 |
| `frontend/apps/web/lib/ai-sse.ts` | SSE 流读取器（fetch + ReadableStream → 事件解析） |
| `frontend/apps/web/actions/ai-actions.ts` | AI 服务端 Actions（历史、操作确认/取消/撤销、额度） |
| `frontend/apps/web/components/ai/ai-assistant-panel.tsx` | AI 面板主组件（状态管理 + SSE 调用） |
| `frontend/apps/web/components/ai/message-list.tsx` | 消息列表（滚动容器 + 自动滚底） |
| `frontend/apps/web/components/ai/message-bubble.tsx` | 单条消息气泡（用户/AI） |
| `frontend/apps/web/components/ai/action-card.tsx` | 操作卡片（已执行/待确认/已撤销三种状态） |
| `frontend/apps/web/components/ai/ai-input.tsx` | 输入区域（文本框 + 发送按钮 + 额度提示） |

### Modified files

| File | Change |
|---|---|
| `backend/pyproject.toml` | 添加 `openai` 依赖 |
| `backend/api/settings.py` | 添加 AI 配置块（API key、model、daily limit） |
| `backend/api/models.py` | 添加 `ChatMessage`、`AIAction`、`DailyUsage` 模型 |
| `backend/api/urls.py` | 添加 AI URL 路由 |
| `frontend/apps/web/app/(dashboard)/kanban-page-client.tsx` | 添加面板切换按钮 + AI 面板组件 |
| `frontend/packages/ui/locales/zh-CN.json` | 添加 `ai.*` 命名空间 |
| `frontend/packages/ui/locales/en.json` | 添加 `ai.*` 命名空间 |

---

## Task 1: Backend Dependencies + Settings

**Files:**
- Modify: `backend/pyproject.toml:5-12`
- Modify: `backend/api/settings.py` (末尾追加)

- [ ] **Step 1: Add `openai` dependency**

在 `backend/pyproject.toml` 的 `dependencies` 列表末尾添加 `openai`:

```toml
dependencies = [
    "django>=5.1",
    "psycopg[binary]>=3.2",
    "djangorestframework>=3.15",
    "djangorestframework-simplejwt>=5.3",
    "drf-spectacular>=0.28",
    "django-unfold>=0.43.0",
    "openai>=1.30",
]
```

- [ ] **Step 2: Add AI settings block**

在 `backend/api/settings.py` 末尾追加:

```python
######################################################################
# AI Assistant
######################################################################
DEEPSEEK_API_KEY = environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = environ.get("DEEPSEEK_MODEL", "deepseek-chat")
AI_DAILY_LIMIT = int(environ.get("AI_DAILY_LIMIT", "50"))
AI_CHAT_HISTORY_LIMIT = 20
AI_TOOL_MAX_ITERATIONS = 5
AI_TOOL_TIMEOUT = 30  # seconds
```

- [ ] **Step 3: Install dependency**

Run: `cd backend && uv sync`

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/api/settings.py backend/uv.lock
git commit -m "feat: 添加 AI 助手依赖和配置项"
```

---

## Task 2: Backend Models + Migration

**Files:**
- Modify: `backend/api/models.py` (末尾追加)
- Create: migration (auto-generated)

- [ ] **Step 1: Add ChatMessage model**

在 `backend/api/models.py` 末尾追加:

```python
class ChatMessage(models.Model):
    """AI 助手聊天记录"""

    ROLE_CHOICES = [
        ("user", "User"),
        ("assistant", "Assistant"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages",
        verbose_name=_("user"),
    )
    role = models.CharField(_("role"), max_length=10, choices=ROLE_CHOICES)
    content = models.TextField(_("content"))
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "chat_messages"
        verbose_name = _("chat message")
        verbose_name_plural = _("chat messages")
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="idx_chat_user_created"),
        ]

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"


class AIAction(models.Model):
    """AI 工具调用操作记录"""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("executed", "Executed"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
        ("undone", "Undone"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        ChatMessage,
        on_delete=models.CASCADE,
        related_name="actions",
        verbose_name=_("message"),
    )
    tool_name = models.CharField(_("tool name"), max_length=50)
    tool_args = models.JSONField(_("tool args"))
    status = models.CharField(_("status"), max_length=10, choices=STATUS_CHOICES, default="pending")
    result = models.JSONField(_("result"), null=True, blank=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "ai_actions"
        verbose_name = _("AI action")
        verbose_name_plural = _("AI actions")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["message"], name="idx_ai_action_message"),
        ]

    def __str__(self):
        return f"{self.tool_name} ({self.status})"


class DailyUsage(models.Model):
    """AI 助手每日使用额度"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ai_daily_usages",
        verbose_name=_("user"),
    )
    date = models.DateField(_("date"))
    count = models.IntegerField(_("count"), default=0)

    class Meta:
        db_table = "daily_usages"
        verbose_name = _("daily usage")
        verbose_name_plural = _("daily usages")
        constraints = [
            models.UniqueConstraint(fields=["user", "date"], name="uq_daily_usage_user_date"),
        ]

    def __str__(self):
        return f"{self.user} - {self.date}: {self.count}"
```

- [ ] **Step 2: Run migration**

Run: `docker compose exec api uv run -- python manage.py makemigrations api`
Then: `docker compose exec api uv run -- python manage.py migrate`

- [ ] **Step 3: Commit**

```bash
git add backend/api/models.py backend/api/migrations/
git commit -m "feat: 添加 ChatMessage、AIAction、DailyUsage 模型"
```

---

## Task 3: Backend AI Serializers

**Files:**
- Create: `backend/api/ai_serializers.py`

- [ ] **Step 1: Create serializer file**

Create `backend/api/ai_serializers.py`:

```python
from rest_framework import serializers

from .models import AIAction, ChatMessage, DailyUsage


class AIActionSerializer(serializers.ModelSerializer):
    """AI 操作记录序列化器"""

    class Meta:
        model = AIAction
        fields = ["id", "tool_name", "tool_args", "status", "result", "created_at"]
        read_only_fields = fields


class ChatMessageSerializer(serializers.ModelSerializer):
    """聊天消息序列化器（含关联操作）"""

    actions = AIActionSerializer(many=True, read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "created_at", "actions"]
        read_only_fields = fields


class ChatRequestSerializer(serializers.Serializer):
    """聊天请求"""

    content = serializers.CharField(max_length=2000)


class AIActionConfirmSerializer(serializers.Serializer):
    """操作确认响应"""

    success = serializers.BooleanField()
    action_id = serializers.UUIDField()
    tool_name = serializers.CharField()
    result = serializers.JSONField(allow_null=True)


class AIActionCancelSerializer(serializers.Serializer):
    """操作取消响应"""

    success = serializers.BooleanField()
    action_id = serializers.UUIDField()
    status = serializers.CharField()


class AIActionUndoSerializer(serializers.Serializer):
    """操作撤销响应"""

    success = serializers.BooleanField()
    action_id = serializers.UUIDField()
    status = serializers.CharField()


class DailyUsageSerializer(serializers.Serializer):
    """每日额度"""

    used = serializers.IntegerField()
    limit = serializers.IntegerField()
    remaining = serializers.IntegerField()
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/ai_serializers.py
git commit -m "feat: 添加 AI 助手序列化器"
```

---

## Task 4: Backend Tool Definitions + Handlers

**Files:**
- Create: `backend/api/ai_tools.py`

- [ ] **Step 1: Create tool definitions and handlers**

Create `backend/api/ai_tools.py`:

```python
"""AI 工具定义和 handler 函数。

每个工具有:
- schema: 传给 OpenAI API 的工具定义
- handler: 接收 (user, args) → 返回 (success, result_dict)
- safety: "safe" | "auto" | "confirm" 分级
"""

import logging
from functools import partial

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import BoardColumn, Tag, Task

logger = logging.getLogger(__name__)


######################################################################
# Tool Schemas (OpenAI function calling format)
######################################################################

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "查询当前用户的任务列表，可按状态、优先级筛选。返回任务的标题、状态、优先级和标签。",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["todo", "in_progress", "done"],
                        "description": "按状态筛选",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                        "description": "按优先级筛选",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_columns",
            "description": "获取当前用户的看板列列表，包含每列的任务数。",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "创建一个新任务。创建后自动通知用户。",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "任务标题"},
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                        "description": "优先级，默认 medium",
                    },
                    "status": {
                        "type": "string",
                        "description": "目标列 slug（如 todo、in_progress、done），默认 todo",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_task",
            "description": "将任务移动到指定列。移动后自动通知用户。",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_title": {
                        "type": "string",
                        "description": "要移动的任务标题（模糊匹配）",
                    },
                    "target_column": {
                        "type": "string",
                        "description": "目标列名称或 slug",
                    },
                },
                "required": ["task_title", "target_column"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_column",
            "description": "创建一个新的看板列。",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "列名称"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reorder_columns",
            "description": "按给定顺序重新排列看板列。",
            "parameters": {
                "type": "object",
                "properties": {
                    "column_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "按新顺序排列的列名列表",
                    },
                },
                "required": ["column_names"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "删除一个任务。这是破坏性操作，需要用户确认后才执行。",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_title": {
                        "type": "string",
                        "description": "要删除的任务标题（模糊匹配）",
                    },
                },
                "required": ["task_title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "batch_move_tasks",
            "description": "将多个任务移动到指定列。这是批量操作，需要用户确认。",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_titles": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "要移动的任务标题列表（模糊匹配）",
                    },
                    "target_column": {
                        "type": "string",
                        "description": "目标列名称或 slug",
                    },
                },
                "required": ["task_titles", "target_column"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "batch_delete_tasks",
            "description": "删除多个任务。这是批量破坏性操作，需要用户确认。",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_titles": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "要删除的任务标题列表（模糊匹配）",
                    },
                },
                "required": ["task_titles"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_column",
            "description": "删除一个看板列及其中的所有任务。这是破坏性操作，需要用户确认。",
            "parameters": {
                "type": "object",
                "properties": {
                    "column_name": {
                        "type": "string",
                        "description": "要删除的列名称",
                    },
                },
                "required": ["column_name"],
            },
        },
    },
]

# 工具安全级别映射
TOOL_SAFETY = {
    "list_tasks": "safe",
    "list_columns": "safe",
    "create_task": "auto",
    "move_task": "auto",
    "create_column": "auto",
    "reorder_columns": "auto",
    "delete_task": "confirm",
    "batch_move_tasks": "confirm",
    "batch_delete_tasks": "confirm",
    "delete_column": "confirm",
}


######################################################################
# Helper: resolve column by name or slug
######################################################################


def _resolve_column(user, name_or_slug):
    """按名称或 slug 查找列，返回 (column, error_msg)。"""
    # 先按 slug 精确匹配
    col = BoardColumn.objects.filter(
        created_by=user, slug=name_or_slug
    ).first()
    if col:
        return col, None
    # 再按名称模糊匹配
    col = BoardColumn.objects.filter(
        created_by=user, name__icontains=name_or_slug
    ).first()
    if col:
        return col, None
    return None, f"未找到列「{name_or_slug}」"


def _resolve_task(user, title):
    """按标题模糊查找任务，返回 (task, error_msg)。"""
    task = (
        Task.objects.active()
        .filter(created_by=user, title__icontains=title)
        .first()
    )
    if task:
        return task, None
    return None, f"未找到任务「{title}」"


######################################################################
# Tool Handlers
# 每个返回 (success: bool, result: dict)
######################################################################


def handle_list_tasks(user, args):
    """查询任务列表"""
    qs = Task.objects.active().filter(created_by=user).select_related("created_by")
    status_filter = args.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)
    priority_filter = args.get("priority")
    if priority_filter:
        qs = qs.filter(priority=priority_filter)
    tasks = qs[:50]  # 最多返回 50 条
    result = [
        {
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "tags": [tag.name for tag in t.tags.all()],
        }
        for t in tasks
    ]
    return True, {"tasks": result, "count": len(result)}


def handle_list_columns(user, args):
    """查询看板列"""
    columns = BoardColumn.objects.filter(created_by=user).order_by("position")
    result = []
    for col in columns:
        task_count = Task.objects.active().filter(
            created_by=user, status=col.slug
        ).count()
        result.append({"name": col.name, "slug": col.slug, "task_count": task_count})
    return True, {"columns": result}


def handle_create_task(user, args):
    """创建任务"""
    title = args.get("title", "")
    if not title.strip():
        return False, {"error": "任务标题不能为空"}
    priority = args.get("priority", "medium")
    status = args.get("status", "todo")
    task = Task.objects.create(
        title=title.strip(),
        priority=priority,
        status=status,
        created_by=user,
    )
    return True, {"task_id": str(task.id), "title": task.title, "status": task.status}


def handle_move_task(user, args):
    """移动任务到其他列"""
    task, err = _resolve_task(user, args.get("task_title", ""))
    if err:
        return False, {"error": err}
    col, err = _resolve_column(user, args.get("target_column", ""))
    if err:
        return False, {"error": err}
    previous_status = task.status
    task.status = col.slug
    task.save(update_fields=["status", "modified_at"])
    return True, {
        "task_title": task.title,
        "from": previous_status,
        "to": col.slug,
        "previous_status": previous_status,
    }


def handle_create_column(user, args):
    """创建看板列"""
    name = args.get("name", "").strip()
    if not name:
        return False, {"error": "列名称不能为空"}
    # 生成 slug
    from django.utils.text import slugify

    base_slug = slugify(name)
    if not base_slug:
        base_slug = "column"
    slug = base_slug
    counter = 1
    while BoardColumn.objects.filter(created_by=user, slug=slug).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1
    # 自动 position
    max_pos = (
        BoardColumn.objects.filter(created_by=user).order_by("-position").values_list("position", flat=True).first()
    )
    column = BoardColumn.objects.create(
        name=name,
        slug=slug,
        position=(max_pos or 0) + 1,
        created_by=user,
    )
    return True, {"column_id": str(column.id), "name": column.name, "slug": column.slug}


def handle_reorder_columns(user, args):
    """重排列顺序"""
    names = args.get("column_names", [])
    if not names:
        return False, {"error": "列名列表不能为空"}
    columns = []
    for i, name in enumerate(names):
        col = BoardColumn.objects.filter(
            created_by=user, name__icontains=name
        ).first()
        if not col:
            return False, {"error": f"未找到列「{name}」"}
        col.position = i
        col.save(update_fields=["position"])
        columns.append(col.name)
    return True, {"order": columns}


def handle_delete_task(user, args):
    """删除任务（待确认）"""
    task, err = _resolve_task(user, args.get("task_title", ""))
    if err:
        return False, {"error": err}
    return True, {"task_title": task.title, "task_id": str(task.id)}


def handle_batch_move_tasks(user, args):
    """批量移动（待确认）"""
    titles = args.get("task_titles", [])
    target = args.get("target_column", "")
    if not titles:
        return False, {"error": "任务列表不能为空"}
    col, err = _resolve_column(user, target)
    if err:
        return False, {"error": err}
    found = []
    not_found = []
    for title in titles:
        task, _ = _resolve_task(user, title)
        if task:
            found.append({"title": task.title, "id": str(task.id)})
        else:
            not_found.append(title)
    return True, {
        "found": found,
        "not_found": not_found,
        "target_column": col.slug,
    }


def handle_batch_delete_tasks(user, args):
    """批量删除（待确认）"""
    titles = args.get("task_titles", [])
    if not titles:
        return False, {"error": "任务列表不能为空"}
    found = []
    not_found = []
    for title in titles:
        task, _ = _resolve_task(user, title)
        if task:
            found.append({"title": task.title, "id": str(task.id)})
        else:
            not_found.append(title)
    return True, {"found": found, "not_found": not_found}


def handle_delete_column(user, args):
    """删除列（待确认）"""
    name = args.get("column_name", "")
    col, err = _resolve_column(user, name)
    if err:
        return False, {"error": err}
    task_count = Task.objects.active().filter(
        created_by=user, status=col.slug
    ).count()
    return True, {
        "column_name": col.name,
        "column_id": str(col.id),
        "task_count": task_count,
    }


# Handler 分发表
TOOL_HANDLERS = {
    "list_tasks": handle_list_tasks,
    "list_columns": handle_list_columns,
    "create_task": handle_create_task,
    "move_task": handle_move_task,
    "create_column": handle_create_column,
    "reorder_columns": handle_reorder_columns,
    "delete_task": handle_delete_task,
    "batch_move_tasks": handle_batch_move_tasks,
    "batch_delete_tasks": handle_batch_delete_tasks,
    "delete_column": handle_delete_column,
}


######################################################################
# Confirm-time executors (破坏性操作确认后真正执行)
######################################################################


def execute_delete_task(user, tool_args):
    """确认后：软删除任务"""
    task = Task.objects.active().filter(
        created_by=user, title__icontains=tool_args.get("task_title", "")
    ).first()
    if not task:
        return False, {"error": "任务不存在"}
    task.is_deleted = True
    task.deleted_at = timezone.now()
    task.save(update_fields=["is_deleted", "deleted_at", "modified_at"])
    return True, {"deleted": True, "task_title": task.title}


def execute_batch_move_tasks(user, tool_args):
    """确认后：批量移动"""
    found = tool_args.get("found", [])
    target = tool_args.get("target_column", "")
    moved = []
    for item in found:
        task = Task.objects.filter(id=item["id"], created_by=user).first()
        if task:
            task.status = target
            task.save(update_fields=["status", "modified_at"])
            moved.append(task.title)
    return True, {"moved": moved, "target_column": target}


def execute_batch_delete_tasks(user, tool_args):
    """确认后：批量软删除"""
    found = tool_args.get("found", [])
    deleted = []
    for item in found:
        task = Task.objects.filter(id=item["id"], created_by=user).first()
        if task:
            task.is_deleted = True
            task.deleted_at = timezone.now()
            task.save(update_fields=["is_deleted", "deleted_at", "modified_at"])
            deleted.append(task.title)
    return True, {"deleted": deleted}


def execute_delete_column(user, tool_args):
    """确认后：删除列"""
    col = BoardColumn.objects.filter(
        id=tool_args.get("column_id"), created_by=user
    ).first()
    if not col:
        return False, {"error": "列不存在"}
    # 软删除该列下的任务
    Task.objects.filter(created_by=user, status=col.slug).update(
        is_deleted=True, deleted_at=timezone.now()
    )
    col.delete()
    return True, {"deleted_column": col.name}


CONFIRM_EXECUTORS = {
    "delete_task": execute_delete_task,
    "batch_move_tasks": execute_batch_move_tasks,
    "batch_delete_tasks": execute_batch_delete_tasks,
    "delete_column": execute_delete_column,
}


######################################################################
# Undo handlers
######################################################################


def undo_create_task(user, tool_args):
    """撤销创建：软删除"""
    task_id = tool_args.get("task_id")
    if not task_id:
        return False, {"error": "无法撤销：缺少任务 ID"}
    task = Task.objects.filter(id=task_id, created_by=user).first()
    if not task:
        return False, {"error": "任务不存在"}
    task.is_deleted = True
    task.deleted_at = timezone.now()
    task.save(update_fields=["is_deleted", "deleted_at", "modified_at"])
    return True, {"undone": True, "task_title": task.title}


def undo_move_task(user, result_data):
    """撤销移动：移回原列"""
    task_title = result_data.get("task_title")
    previous_status = result_data.get("previous_status")
    if not task_title or not previous_status:
        return False, {"error": "无法撤销：缺少原状态信息"}
    task = Task.objects.active().filter(
        created_by=user, title__icontains=task_title
    ).first()
    if not task:
        return False, {"error": "任务不存在"}
    task.status = previous_status
    task.save(update_fields=["status", "modified_at"])
    return True, {"undone": True, "task_title": task.title, "restored_to": previous_status}


def undo_create_column(user, tool_args):
    """撤销创建列：删除列"""
    column_id = tool_args.get("column_id")
    if not column_id:
        return False, {"error": "无法撤销：缺少列 ID"}
    col = BoardColumn.objects.filter(id=column_id, created_by=user).first()
    if not col:
        return False, {"error": "列不存在"}
    col.delete()
    return True, {"undone": True, "column_name": col.name}


def undo_delete_task(user, result_data):
    """撤销删除：恢复任务"""
    task_title = result_data.get("task_title")
    if not task_title:
        return False, {"error": "无法撤销：缺少任务标题"}
    task = (
        Task.objects.filter(created_by=user, title__icontains=task_title)
        .order_by("-modified_at")
        .first()
    )
    if not task or not task.is_deleted:
        return False, {"error": "未找到已删除的任务"}
    task.is_deleted = False
    task.deleted_at = None
    task.save(update_fields=["is_deleted", "deleted_at", "modified_at"])
    return True, {"undone": True, "task_title": task.title}


UNDO_HANDLERS = {
    "create_task": undo_create_task,
    "move_task": undo_move_task,
    "create_column": undo_create_column,
    "delete_task": undo_delete_task,
}


######################################################################
# System Prompt Builder
######################################################################


def build_system_prompt(user):
    """构建 system prompt，包含当前看板摘要。"""
    columns = BoardColumn.objects.filter(created_by=user).order_by("position")
    tags = Tag.objects.filter(created_by=user)

    column_summary = ""
    for col in columns:
        task_count = Task.objects.active().filter(
            created_by=user, status=col.slug
        ).count()
        column_summary += f"\n- {col.name} ({task_count}个任务)"

    tag_names = ", ".join(t.name for t in tags[:20])  # 最多 20 个标签
    total_tasks = Task.objects.active().filter(created_by=user).count()

    return f"""你是一个看板任务管理助手。用户会通过自然语言请你帮忙管理看板上的任务。

当前看板状态:
- 列:{column_summary}
- 标签: {tag_names or '无'}
- 总任务数: {total_tasks}个

你可以使用工具来查询、创建、移动和删除任务和列。

规则:
- 优先使用工具完成操作，操作完成后用简短的中文回复确认
- 如果不确定用户意图，追问而不是猜测
- 不要执行用户没有明确要求的操作
- 任务操作仅限当前用户自己的任务
- 回复使用中文
- 不要在回复中提及工具名称或技术细节，用自然语言描述操作结果"""


######################################################################
# Public dispatch function
######################################################################


def dispatch_tool(tool_name, user, tool_args):
    """分发工具调用到对应 handler。

    返回:
        (success, result_data, safety_level)
        safety_level 用于判断是否需要用户确认。
        对于 confirm 级别的工具，handler 只是预检查参数，
        真正执行在 confirm 阶段。
    """
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        return False, {"error": f"未知工具: {tool_name}"}, None

    safety = TOOL_SAFETY.get(tool_name, "confirm")
    success, result = handler(user, tool_args)
    return success, result, safety
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/ai_tools.py
git commit -m "feat: 添加 AI 工具定义、handler、撤销逻辑"
```

---

## Task 5: Backend AI Views + URL Routing

**Files:**
- Create: `backend/api/ai_views.py`
- Modify: `backend/api/urls.py:1-46`

- [ ] **Step 1: Create AI views**

Create `backend/api/ai_views.py`:

```python
import json
import logging
from datetime import date

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from openai import OpenAI
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai_serializers import (
    ChatMessageSerializer,
    ChatRequestSerializer,
    DailyUsageSerializer,
)
from .ai_tools import (
    CONFIRM_EXECUTORS,
    TOOL_SCHEMAS,
    UNDO_HANDLERS,
    build_system_prompt,
    dispatch_tool,
)
from .models import AIAction, ChatMessage, DailyUsage

logger = logging.getLogger(__name__)


def _get_or_create_daily_usage(user):
    """获取或创建今日额度记录。"""
    today = date.today()
    usage, _ = DailyUsage.objects.get_or_create(user=user, date=today)
    return usage


def _check_rate_limit(user):
    """检查每日额度，返回 (allowed, usage_obj)。"""
    usage = _get_or_create_daily_usage(user)
    return usage.count < settings.AI_DAILY_LIMIT, usage


def _build_messages(user, user_content):
    """构建发送给 DeepSeek 的 messages 列表。"""
    messages = [{"role": "system", "content": build_system_prompt(user)}]

    # 历史消息
    history = (
        ChatMessage.objects.filter(user=user)
        .order_by("-created_at")[: settings.AI_CHAT_HISTORY_LIMIT]
    )
    for msg in reversed(history):
        messages.append({"role": msg.role, "content": msg.content})

    # 当前用户消息
    messages.append({"role": "user", "content": user_content})
    return messages


class AIChatHistoryView(APIView):
    """获取聊天历史"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_chat_history",
        responses=ChatMessageSerializer(many=True),
    )
    def get(self, request):
        messages = (
            ChatMessage.objects.filter(user=request.user)
            .prefetch_related("actions")
            .order_by("-created_at")[: settings.AI_CHAT_HISTORY_LIMIT]
        )
        serializer = ChatMessageSerializer(reversed(messages), many=True)
        return Response({"messages": serializer.data})


class AIChatView(APIView):
    """SSE 流式聊天"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_chat",
        request=ChatRequestSerializer,
        responses={(200, "text/event-stream"): None},
    )
    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]

        # 额度检查
        allowed, usage = _check_rate_limit(request.user)
        if not allowed:
            return Response(
                {"detail": "今日额度已用完"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # 保存用户消息
        user_msg = ChatMessage.objects.create(
            user=request.user, role="user", content=content
        )

        # 增加额度计数
        usage.count += 1
        usage.save(update_fields=["count"])

        # 清理历史（保留最近 200 条）
        self._cleanup_history(request.user)

        # SSE 流式响应
        from django.http import StreamingHttpResponse

        response = StreamingHttpResponse(
            self._stream_chat(request.user, content, user_msg),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

    def _stream_chat(self, user, content, user_msg):
        """生成 SSE 事件流。"""
        client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
        messages = _build_messages(user, content)

        assistant_content = ""
        assistant_msg = None

        try:
            for iteration in range(settings.AI_TOOL_MAX_ITERATIONS):
                has_tool_call = False
                stream = client.chat.completions.create(
                    model=settings.DEEPSEEK_MODEL,
                    messages=messages,
                    tools=TOOL_SCHEMAS,
                    stream=True,
                    timeout=settings.AI_TOOL_TIMEOUT,
                )

                current_text = ""
                current_tool_calls = {}

                for chunk in stream:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if not delta:
                        continue

                    # 文本输出
                    if delta.content:
                        current_text += delta.content
                        yield self._sse_event(
                            "message",
                            {"type": "text", "content": delta.content},
                        )

                    # 工具调用（流式累积）
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in current_tool_calls:
                                current_tool_calls[idx] = {
                                    "id": "",
                                    "name": "",
                                    "arguments": "",
                                }
                            if tc.id:
                                current_tool_calls[idx]["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    current_tool_calls[idx]["name"] = (
                                        tc.function.name
                                    )
                                if tc.function.arguments:
                                    current_tool_calls[idx]["arguments"] += (
                                        tc.function.arguments
                                    )

                # 累积文本到完整回复
                assistant_content += current_text

                # 处理工具调用
                if current_tool_calls:
                    has_tool_call = True
                    # 创建 assistant 消息（如果还没有）
                    if not assistant_msg:
                        assistant_msg = ChatMessage.objects.create(
                            user=user,
                            role="assistant",
                            content=assistant_content or "正在处理操作...",
                        )

                    # 将 assistant 回复加入 messages
                    messages.append(
                        {"role": "assistant", "content": current_text or ""}
                    )

                    for idx in sorted(current_tool_calls.keys()):
                        tc_data = current_tool_calls[idx]
                        tool_name = tc_data["name"]
                        try:
                            tool_args = json.loads(tc_data["arguments"])
                        except json.JSONDecodeError:
                            tool_args = {}

                        # 分发执行
                        success, result, safety = dispatch_tool(
                            tool_name, user, tool_args
                        )

                        if safety in ("safe", "auto"):
                            # 安全/自动操作：直接执行
                            action_status = "executed" if success else "cancelled"
                        else:
                            # 需确认操作：存为 pending
                            action_status = "pending"

                        action = AIAction.objects.create(
                            message=assistant_msg,
                            tool_name=tool_name,
                            tool_args=tool_args,
                            status=action_status,
                            result=result if success else None,
                        )

                        # 发送 action 事件
                        yield self._sse_event(
                            "message",
                            {
                                "type": "action",
                                "action_id": str(action.id),
                                "tool_name": tool_name,
                                "tool_args": tool_args,
                                "status": action_status,
                                "result": result,
                            },
                        )

                        # 将工具结果回传给 AI
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tc_data["id"],
                                "content": json.dumps(
                                    result, ensure_ascii=False
                                ),
                            }
                        )

                if not has_tool_call:
                    break

        except Exception as e:
            logger.exception("AI chat stream error")
            yield self._sse_event(
                "message",
                {"type": "error", "content": "AI 服务暂时不可用，请稍后重试"},
            )

        # 保存最终的 assistant 消息
        if not assistant_msg:
            assistant_msg = ChatMessage.objects.create(
                user=user,
                role="assistant",
                content=assistant_content or "",
            )
        elif assistant_content and assistant_msg.content != assistant_content:
            assistant_msg.content = assistant_content
            assistant_msg.save(update_fields=["content"])

        yield self._sse_event("message", {"type": "done"})

    def _sse_event(self, event_type, data):
        """格式化 SSE 事件。"""
        return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    def _cleanup_history(self, user):
        """保留最近 200 条历史，删除更早的。"""
        old_ids = list(
            ChatMessage.objects.filter(user=user)
            .order_by("-created_at")
            .values_list("id", flat=True)[200:]
        )
        if old_ids:
            ChatMessage.objects.filter(id__in=old_ids).delete()


class AIActionConfirmView(APIView):
    """确认待执行操作"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_action_confirm",
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            action = AIAction.objects.get(
                id=pk, message__user=request.user, status="pending"
            )
        except AIAction.DoesNotExist:
            return Response(
                {"detail": "操作不存在或已处理"},
                status=status.HTTP_404_NOT_FOUND,
            )

        executor = CONFIRM_EXECUTORS.get(action.tool_name)
        if not executor:
            return Response(
                {"detail": "无法确认该操作"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        success, result = executor(request.user, action.tool_args)
        action.status = "confirmed" if success else "cancelled"
        action.result = result
        action.save(update_fields=["status", "result"])

        return Response(
            {
                "success": success,
                "action_id": str(action.id),
                "tool_name": action.tool_name,
                "result": result,
            }
        )


class AIActionCancelView(APIView):
    """取消待执行操作"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_action_cancel",
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            action = AIAction.objects.get(
                id=pk, message__user=request.user, status="pending"
            )
        except AIAction.DoesNotExist:
            return Response(
                {"detail": "操作不存在或已处理"},
                status=status.HTTP_404_NOT_FOUND,
            )

        action.status = "cancelled"
        action.save(update_fields=["status"])

        return Response(
            {
                "success": True,
                "action_id": str(action.id),
                "status": "cancelled",
            }
        )


class AIActionUndoView(APIView):
    """撤销已执行操作"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_action_undo",
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            action = AIAction.objects.get(
                id=pk,
                message__user=request.user,
                status__in=["executed", "confirmed"],
            )
        except AIAction.DoesNotExist:
            return Response(
                {"detail": "操作不存在或无法撤销"},
                status=status.HTTP_404_NOT_FOUND,
            )

        undo_handler = UNDO_HANDLERS.get(action.tool_name)
        if not undo_handler:
            return Response(
                {"detail": "该操作不支持撤销"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # move_task 的 undo 从 result 取 previous_status
        if action.tool_name == "move_task":
            success, result = undo_handler(request.user, action.result or {})
        else:
            success, result = undo_handler(request.user, action.tool_args)

        if success:
            action.status = "undone"
            action.save(update_fields=["status"])

        return Response(
            {
                "success": success,
                "action_id": str(action.id),
                "status": "undone" if success else action.status,
                "result": result,
            }
        )


class AIUsageView(APIView):
    """获取今日额度"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_usage",
        responses=DailyUsageSerializer,
    )
    def get(self, request):
        usage = _get_or_create_daily_usage(request.user)
        return Response(
            {
                "used": usage.count,
                "limit": settings.AI_DAILY_LIMIT,
                "remaining": max(0, settings.AI_DAILY_LIMIT - usage.count),
            }
        )
```

- [ ] **Step 2: Add AI URL routes**

在 `backend/api/urls.py` 中:

添加导入（第 8-16 行区域追加）:
```python
from .ai_views import (
    AIActionCancelView,
    AIActionConfirmView,
    AIActionUndoView,
    AIChatHistoryView,
    AIChatView,
    AIUsageView,
)
```

在 `urlpatterns` 列表（第 40 行 `path("api/admin/health/"...` 之后）添加:
```python
    # AI 助手 API
    path("api/ai/chat/history/", AIChatHistoryView.as_view(), name="ai-chat-history"),
    path("api/ai/chat/", AIChatView.as_view(), name="ai-chat"),
    path("api/ai/actions/<uuid:pk>/confirm/", AIActionConfirmView.as_view(), name="ai-action-confirm"),
    path("api/ai/actions/<uuid:pk>/cancel/", AIActionCancelView.as_view(), name="ai-action-cancel"),
    path("api/ai/actions/<uuid:pk>/undo/", AIActionUndoView.as_view(), name="ai-action-undo"),
    path("api/ai/usage/", AIUsageView.as_view(), name="ai-usage"),
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/ai_views.py backend/api/urls.py
git commit -m "feat: 添加 AI 助手 API 视图和 URL 路由"
```

---

## Task 6: Backend Tests

**Files:**
- Create: `backend/api/tests/test_ai.py`

- [ ] **Step 1: Write comprehensive tests**

Create `backend/api/tests/test_ai.py`:

```python
import json
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status

from api.models import AIAction, BoardColumn, ChatMessage, DailyUsage, Tag, Task


######################################################################
# Models
######################################################################


@pytest.mark.django_db
class TestAIModels:
    def test_create_chat_message(self, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="user", content="你好"
        )
        assert msg.role == "user"
        assert msg.content == "你好"

    def test_create_ai_action(self, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="assistant", content="好的"
        )
        action = AIAction.objects.create(
            message=msg,
            tool_name="list_tasks",
            tool_args={},
            status="executed",
            result={"tasks": []},
        )
        assert action.tool_name == "list_tasks"
        assert action.status == "executed"

    def test_daily_usage_unique(self, regular_user):
        DailyUsage.objects.create(user=regular_user, date=date.today(), count=5)
        with pytest.raises(Exception):
            DailyUsage.objects.create(user=regular_user, date=date.today(), count=3)


######################################################################
# Tool Handlers
######################################################################


@pytest.mark.django_db
class TestToolHandlers:
    def test_list_tasks(self, regular_user):
        Task.objects.create(title="任务A", status="todo", created_by=regular_user)
        Task.objects.create(
            title="任务B", status="done", priority="high", created_by=regular_user
        )
        from api.ai_tools import handle_list_tasks

        success, result = handle_list_tasks(regular_user, {})
        assert success
        assert result["count"] == 2

    def test_list_tasks_filter_status(self, regular_user):
        Task.objects.create(title="任务A", status="todo", created_by=regular_user)
        Task.objects.create(title="任务B", status="done", created_by=regular_user)
        from api.ai_tools import handle_list_tasks

        success, result = handle_list_tasks(regular_user, {"status": "done"})
        assert success
        assert result["count"] == 1

    def test_list_columns(self, regular_user):
        BoardColumn.objects.create(
            name="待办", slug="todo", position=0, created_by=regular_user
        )
        from api.ai_tools import handle_list_columns

        success, result = handle_list_columns(regular_user, {})
        assert success
        assert len(result["columns"]) == 1
        assert result["columns"][0]["name"] == "待办"

    def test_create_task(self, regular_user):
        from api.ai_tools import handle_create_task

        success, result = handle_create_task(
            regular_user, {"title": "新任务", "priority": "high"}
        )
        assert success
        assert result["title"] == "新任务"
        assert Task.objects.filter(title="新任务").exists()

    def test_create_task_empty_title(self, regular_user):
        from api.ai_tools import handle_create_task

        success, result = handle_create_task(regular_user, {"title": ""})
        assert not success

    def test_move_task(self, regular_user):
        Task.objects.create(title="测试任务", status="todo", created_by=regular_user)
        BoardColumn.objects.create(
            name="进行中", slug="in_progress", position=1, created_by=regular_user
        )
        from api.ai_tools import handle_move_task

        success, result = handle_move_task(
            regular_user,
            {"task_title": "测试", "target_column": "进行中"},
        )
        assert success
        assert result["previous_status"] == "todo"
        assert result["to"] == "in_progress"

    def test_move_task_not_found(self, regular_user):
        from api.ai_tools import handle_move_task

        success, result = handle_move_task(
            regular_user,
            {"task_title": "不存在", "target_column": "todo"},
        )
        assert not success

    def test_create_column(self, regular_user):
        from api.ai_tools import handle_create_column

        success, result = handle_create_column(
            regular_user, {"name": "审核中"}
        )
        assert success
        assert result["name"] == "审核中"

    def test_reorder_columns(self, regular_user):
        BoardColumn.objects.create(
            name="待办", slug="todo", position=0, created_by=regular_user
        )
        BoardColumn.objects.create(
            name="完成", slug="done", position=1, created_by=regular_user
        )
        from api.ai_tools import handle_reorder_columns

        success, result = handle_reorder_columns(
            regular_user, {"column_names": ["完成", "待办"]}
        )
        assert success
        assert result["order"] == ["完成", "待办"]

    def test_dispatch_unknown_tool(self, regular_user):
        from api.ai_tools import dispatch_tool

        success, result, safety = dispatch_tool("unknown_tool", regular_user, {})
        assert not success

    def test_dispatch_safe_tool_auto_executes(self, regular_user):
        Task.objects.create(title="测试", status="todo", created_by=regular_user)
        from api.ai_tools import dispatch_tool

        success, result, safety = dispatch_tool("list_tasks", regular_user, {})
        assert success
        assert safety == "safe"

    def test_dispatch_confirm_tool_returns_pending(self, regular_user):
        Task.objects.create(title="测试", status="todo", created_by=regular_user)
        from api.ai_tools import dispatch_tool

        success, result, safety = dispatch_tool(
            "delete_task", regular_user, {"task_title": "测试"}
        )
        assert success
        assert safety == "confirm"


######################################################################
# Confirm Executors
######################################################################


@pytest.mark.django_db
class TestConfirmExecutors:
    def test_execute_delete_task(self, regular_user):
        task = Task.objects.create(title="要删除的", status="todo", created_by=regular_user)
        from api.ai_tools import execute_delete_task

        success, result = execute_delete_task(
            regular_user, {"task_title": "要删除的"}
        )
        assert success
        task.refresh_from_db()
        assert task.is_deleted is True

    def test_execute_batch_move_tasks(self, regular_user):
        t1 = Task.objects.create(title="A", status="todo", created_by=regular_user)
        t2 = Task.objects.create(title="B", status="todo", created_by=regular_user)
        from api.ai_tools import execute_batch_move_tasks

        success, result = execute_batch_move_tasks(
            regular_user,
            {
                "found": [
                    {"title": "A", "id": str(t1.id)},
                    {"title": "B", "id": str(t2.id)},
                ],
                "target_column": "in_progress",
            },
        )
        assert success
        t1.refresh_from_db()
        assert t1.status == "in_progress"


######################################################################
# Undo Handlers
######################################################################


@pytest.mark.django_db
class TestUndoHandlers:
    def test_undo_create_task(self, regular_user):
        from api.ai_tools import handle_create_task, undo_create_task

        _, create_result = handle_create_task(
            regular_user, {"title": "临时任务"}
        )
        success, result = undo_create_task(regular_user, create_result)
        assert success
        assert not Task.objects.filter(title="临时任务", is_deleted=False).exists()

    def test_undo_move_task(self, regular_user):
        Task.objects.create(title="移动测试", status="todo", created_by=regular_user)
        BoardColumn.objects.create(
            name="进行中", slug="in_progress", position=1, created_by=regular_user
        )
        from api.ai_tools import handle_move_task, undo_move_task

        _, move_result = handle_move_task(
            regular_user,
            {"task_title": "移动", "target_column": "进行中"},
        )
        success, result = undo_move_task(regular_user, move_result)
        assert success
        task = Task.objects.get(title="移动测试")
        assert task.status == "todo"


######################################################################
# System Prompt
######################################################################


@pytest.mark.django_db
class TestSystemPrompt:
    def test_build_system_prompt(self, regular_user):
        BoardColumn.objects.create(
            name="待办", slug="todo", position=0, created_by=regular_user
        )
        from api.ai_tools import build_system_prompt

        prompt = build_system_prompt(regular_user)
        assert "待办" in prompt
        assert "看板任务管理助手" in prompt


######################################################################
# API Views
######################################################################


@pytest.mark.django_db
class TestAIChatHistoryView:
    def test_get_history_empty(self, api_client, regular_user):
        api_client.force_authenticate(regular_user)
        response = api_client.get("/api/ai/chat/history/")
        assert response.status_code == 200
        assert response.data["messages"] == []

    def test_get_history_with_messages(self, api_client, regular_user):
        ChatMessage.objects.create(user=regular_user, role="user", content="你好")
        ChatMessage.objects.create(user=regular_user, role="assistant", content="你好！")
        api_client.force_authenticate(regular_user)
        response = api_client.get("/api/ai/chat/history/")
        assert response.status_code == 200
        assert len(response.data["messages"]) == 2

    def test_get_history_unauthenticated(self, api_client):
        response = api_client.get("/api/ai/chat/history/")
        assert response.status_code in (401, 403)


@pytest.mark.django_db
class TestAIUsageView:
    def test_get_usage(self, api_client, regular_user):
        api_client.force_authenticate(regular_user)
        response = api_client.get("/api/ai/usage/")
        assert response.status_code == 200
        assert response.data["limit"] == 50
        assert response.data["remaining"] == 50

    def test_get_usage_after_chat(self, api_client, regular_user):
        DailyUsage.objects.create(user=regular_user, date=date.today(), count=5)
        api_client.force_authenticate(regular_user)
        response = api_client.get("/api/ai/usage/")
        assert response.data["used"] == 5
        assert response.data["remaining"] == 45


@pytest.mark.django_db
class TestAIRateLimit:
    def test_chat_returns_429_when_limit_reached(self, api_client, regular_user):
        DailyUsage.objects.create(user=regular_user, date=date.today(), count=50)
        api_client.force_authenticate(regular_user)
        response = api_client.post(
            "/api/ai/chat/",
            {"content": "测试"},
            format="json",
        )
        assert response.status_code == 429


@pytest.mark.django_db
class TestAIActionViews:
    def test_confirm_pending_action(self, api_client, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="assistant", content="确认删除？"
        )
        task = Task.objects.create(title="要删除的", created_by=regular_user)
        action = AIAction.objects.create(
            message=msg,
            tool_name="delete_task",
            tool_args={"task_title": "要删除的"},
            status="pending",
        )
        api_client.force_authenticate(regular_user)
        response = api_client.post(f"/api/ai/actions/{action.id}/confirm/")
        assert response.status_code == 200
        assert response.data["success"] is True
        action.refresh_from_db()
        assert action.status == "confirmed"

    def test_cancel_pending_action(self, api_client, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="assistant", content="确认删除？"
        )
        action = AIAction.objects.create(
            message=msg,
            tool_name="delete_task",
            tool_args={"task_title": "test"},
            status="pending",
        )
        api_client.force_authenticate(regular_user)
        response = api_client.post(f"/api/ai/actions/{action.id}/cancel/")
        assert response.status_code == 200
        action.refresh_from_db()
        assert action.status == "cancelled"

    def test_undo_executed_action(self, api_client, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="assistant", content="已创建"
        )
        task = Task.objects.create(title="AI 创建的", created_by=regular_user)
        action = AIAction.objects.create(
            message=msg,
            tool_name="create_task",
            tool_args={"title": "AI 创建的", "task_id": str(task.id)},
            status="executed",
            result={"task_id": str(task.id), "title": "AI 创建的"},
        )
        api_client.force_authenticate(regular_user)
        response = api_client.post(f"/api/ai/actions/{action.id}/undo/")
        assert response.status_code == 200
        assert response.data["success"] is True
        action.refresh_from_db()
        assert action.status == "undone"

    def test_confirm_nonexistent_action(self, api_client, regular_user):
        api_client.force_authenticate(regular_user)
        response = api_client.post(
            "/api/ai/actions/00000000-0000-0000-0000-000000000000/confirm/"
        )
        assert response.status_code == 404
```

- [ ] **Step 2: Run tests**

Run: `docker compose exec api uv run -- pytest api/tests/test_ai.py -v`
Expected: All tests PASS

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `docker compose exec api uv run -- pytest . -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/api/tests/test_ai.py
git commit -m "test: 添加 AI 助手后端测试"
```

---

## Task 7: Frontend Types + SSE Utility

**Files:**
- Create: `frontend/apps/web/lib/ai-types.ts`
- Create: `frontend/apps/web/lib/ai-sse.ts`

- [ ] **Step 1: Create AI types**

Create `frontend/apps/web/lib/ai-types.ts`:

```typescript
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

export type SSEEvent = SSETextEvent | SSEActionEvent | SSEDoneEvent | SSEErrorEvent

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
```

- [ ] **Step 2: Create SSE stream reader**

Create `frontend/apps/web/lib/ai-sse.ts`:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/web/lib/ai-types.ts frontend/apps/web/lib/ai-sse.ts
git commit -m "feat: 添加前端 AI 类型和 SSE 流读取器"
```

---

## Task 8: Frontend Server Actions

**Files:**
- Create: `frontend/apps/web/actions/ai-actions.ts`

- [ ] **Step 1: Create AI server actions**

Create `frontend/apps/web/actions/ai-actions.ts`:

```typescript
'use server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import type { ChatMessage, DailyUsage } from '@/lib/ai-types'

const API_BASE = process.env.API_URL || 'http://api:8000'

async function aiFetch(path: string, options: RequestInit = {}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { success: false, message: '未登录' }
  }
  const token = (session as { accessToken?: string }).accessToken || ''

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: '请求失败' }))
      return { success: false, message: data.detail || '请求失败' }
    }
    const data = await res.json()
    return { success: true, data }
  } catch {
    return { success: false, message: '网络错误' }
  }
}

export async function getChatHistory(): Promise<
  { success: true; data: { messages: ChatMessage[] } } | { success: false; message: string }
> {
  return aiFetch('/api/ai/chat/history/') as Promise<typeof aiFetch>
}

export async function confirmAction(actionId: string) {
  return aiFetch(`/api/ai/actions/${actionId}/confirm/`, { method: 'POST' })
}

export async function cancelAction(actionId: string) {
  return aiFetch(`/api/ai/actions/${actionId}/cancel/`, { method: 'POST' })
}

export async function undoAction(actionId: string) {
  return aiFetch(`/api/ai/actions/${actionId}/undo/`, { method: 'POST' })
}

export async function getUsage(): Promise<
  { success: true; data: DailyUsage } | { success: false; message: string }
> {
  return aiFetch('/api/ai/usage/') as Promise<typeof aiFetch>
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/actions/ai-actions.ts
git commit -m "feat: 添加前端 AI 服务端 Actions"
```

---

## Task 9: Frontend AI Panel Components

**Files:**
- Create: `frontend/apps/web/components/ai/ai-input.tsx`
- Create: `frontend/apps/web/components/ai/message-bubble.tsx`
- Create: `frontend/apps/web/components/ai/action-card.tsx`
- Create: `frontend/apps/web/components/ai/message-list.tsx`
- Create: `frontend/apps/web/components/ai/ai-assistant-panel.tsx`

- [ ] **Step 1: Create input component**

Create `frontend/apps/web/components/ai/ai-input.tsx`:

```tsx
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
```

- [ ] **Step 2: Create message bubble**

Create `frontend/apps/web/components/ai/message-bubble.tsx`:

```tsx
'use client'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gray-800 px-3 py-2 text-sm text-white">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800">
        {content}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create action card**

Create `frontend/apps/web/components/ai/action-card.tsx`:

```tsx
'use client'

import { useTranslations } from 'next-intl'

import type { AIAction } from '@/lib/ai-types'

interface ActionCardProps {
  action: AIAction
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onUndo: (id: string) => void
}

const TOOL_LABELS: Record<string, string> = {
  create_task: '📝 create_task',
  move_task: '🔄 move_task',
  create_column: '📋 create_column',
  reorder_columns: '🔀 reorder_columns',
  delete_task: '🗑️ delete_task',
  batch_move_tasks: '🔄 batch_move',
  batch_delete_tasks: '🗑️ batch_delete',
  delete_column: '🗑️ delete_column',
  list_tasks: '🔍 list_tasks',
  list_columns: '🔍 list_columns',
}

export function ActionCard({ action, onConfirm, onCancel, onUndo }: ActionCardProps) {
  const t = useTranslations('ai')

  const borderColor =
    action.status === 'pending'
      ? 'border-red-200'
      : action.status === 'undone'
        ? 'border-gray-200'
        : action.status === 'cancelled'
          ? 'border-gray-200'
          : 'border-green-200'

  return (
    <div className={`rounded-lg border ${borderColor} bg-white p-2.5 text-xs`}>
      <div className="font-medium text-gray-700">
        {TOOL_LABELS[action.tool_name] || action.tool_name}
      </div>
      <div className="mt-1 text-gray-500">
        {formatToolArgs(action.tool_name, action.tool_args, action.result)}
      </div>

      {/* 状态指示 */}
      {action.status === 'executed' && (
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
            ✓ {t('executed')}
          </span>
          <button
            type="button"
            onClick={() => onUndo(action.id)}
            className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-100"
          >
            {t('undo')}
          </button>
        </div>
      )}
      {action.status === 'confirmed' && (
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
            ✓ {t('confirmed')}
          </span>
          <button
            type="button"
            onClick={() => onUndo(action.id)}
            className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-100"
          >
            {t('undo')}
          </button>
        </div>
      )}
      {action.status === 'pending' && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onConfirm(action.id)}
            className="rounded bg-red-50 px-2 py-0.5 text-[10px] text-red-600 transition-colors hover:bg-red-100"
          >
            {t('confirm')}
          </button>
          <button
            type="button"
            onClick={() => onCancel(action.id)}
            className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600 transition-colors hover:bg-gray-100"
          >
            {t('cancel')}
          </button>
        </div>
      )}
      {action.status === 'undone' && (
        <span className="mt-2 inline-block rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
          {t('undone')}
        </span>
      )}
      {action.status === 'cancelled' && (
        <span className="mt-2 inline-block rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
          {t('cancelled')}
        </span>
      )}
    </div>
  )
}

function formatToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  result: Record<string, unknown> | null,
): string {
  switch (toolName) {
    case 'move_task':
      return `「${args.task_title}」→「${args.target_column}」`
    case 'create_task':
      return `创建「${args.title}」`
    case 'delete_task':
      return `删除「${args.task_title}」`
    case 'create_column':
      return `创建列「${args.name}」`
    case 'delete_column':
      return `删除列「${args.column_name}」`
    case 'batch_move_tasks': {
      const titles = (args.task_titles as string[])?.join('、') || ''
      return `${titles} →「${args.target_column}」`
    }
    case 'batch_delete_tasks': {
      const titles = (args.task_titles as string[])?.join('、') || ''
      return `删除 ${titles}`
    }
    case 'reorder_columns': {
      const names = (args.column_names as string[])?.join(' → ') || ''
      return names
    }
    default:
      return JSON.stringify(args)
  }
}
```

- [ ] **Step 4: Create message list**

Create `frontend/apps/web/components/ai/message-list.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'

import type { AIAction, ChatMessage } from '@/lib/ai-types'

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
```

- [ ] **Step 5: Create main panel component**

Create `frontend/apps/web/components/ai/ai-assistant-panel.tsx`:

```tsx
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
```

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/web/components/ai/
git commit -m "feat: 添加 AI 助手前端面板组件"
```

---

## Task 10: Frontend Integration

**Files:**
- Modify: `frontend/apps/web/app/(dashboard)/kanban-page-client.tsx`
- Modify: `frontend/packages/ui/locales/zh-CN.json` (添加 `ai.*` 命名空间)
- Modify: `frontend/packages/ui/locales/en.json` (添加 `ai.*` 命名空间)

- [ ] **Step 1: Modify kanban page to include AI panel**

Replace the entire content of `frontend/apps/web/app/(dashboard)/kanban-page-client.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { getTasks } from '@/actions/task-actions'
import { AIAssistantPanel } from '@/components/ai/ai-assistant-panel'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { TaskModal } from '@/components/kanban/task-modal'
import type { Task, Tag, Column } from '@/lib/kanban-utils'

interface KanbanPageClientProps {
  initialTasks: Task[]
  tags: Tag[]
  columns: Column[]
}

export function KanbanPageClient({ initialTasks, tags, columns }: KanbanPageClientProps) {
  const t = useTranslations('kanban')
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [columnList, setColumnList] = useState<Column[]>(columns)
  // undefined = 关闭, null = 创建模式, task = 编辑模式
  const [modalTask, setModalTask] = useState<Task | null | undefined>(undefined)
  const [showAI, setShowAI] = useState(false)

  const refreshTasks = async () => {
    const result = await getTasks()
    if (result.success) {
      setTasks(result.data?.results || [])
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* 看板主区域 */}
      <div className={`flex-1 overflow-hidden ${showAI ? '' : ''}`}>
        <div className="h-full overflow-y-auto p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setModalTask(null)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              + {t('addTask')}
            </button>
            <button
              onClick={() => setShowAI(!showAI)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              ✨ AI {showAI ? '✕' : ''}
            </button>
          </div>

          <KanbanBoard
            initialTasks={tasks}
            tags={tags}
            columns={columnList}
            onColumnsChange={setColumnList}
            onTaskClick={(task) => setModalTask(task)}
          />
        </div>
      </div>

      {/* AI 面板 */}
      {showAI && (
        <div className="w-[340px] shrink-0">
          <AIAssistantPanel />
        </div>
      )}

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          tags={tags}
          columns={columnList}
          onClose={() => setModalTask(undefined)}
          onSuccess={refreshTasks}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Chinese i18n strings**

在 `frontend/packages/ui/locales/zh-CN.json` 中添加 `ai` 命名空间（在已有根级别 key 之后追加）:

```json
"ai": {
  "title": "AI 助手",
  "inputPlaceholder": "输入消息，如「创建一个高优先级任务」",
  "send": "发送",
  "remaining": "今日剩余 {count} 条",
  "executed": "已执行",
  "confirmed": "已确认",
  "undo": "撤销",
  "confirm": "确认",
  "cancel": "取消",
  "undone": "已撤销",
  "cancelled": "已取消"
}
```

- [ ] **Step 3: Add English i18n strings**

在 `frontend/packages/ui/locales/en.json` 中添加 `ai` 命名空间:

```json
"ai": {
  "title": "AI Assistant",
  "inputPlaceholder": "Type a message, e.g. \"Create a high priority task\"",
  "send": "Send",
  "remaining": "{count} remaining today",
  "executed": "Executed",
  "confirmed": "Confirmed",
  "undo": "Undo",
  "confirm": "Confirm",
  "cancel": "Cancel",
  "undone": "Undone",
  "cancelled": "Cancelled"
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/web/app/\(dashboard\)/kanban-page-client.tsx frontend/packages/ui/locales/zh-CN.json frontend/packages/ui/locales/en.json
git commit -m "feat: 集成 AI 面板到看板页面 + 添加国际化"
```

---

## Task 11: Environment Config + Docker

**Files:**
- Modify: `.env.backend` (添加 AI 相关环境变量)

- [ ] **Step 1: Add AI environment variables**

在 `.env.backend` 末尾追加:

```
# AI Assistant
DEEPSEEK_API_KEY=your-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
AI_DAILY_LIMIT=50
```

- [ ] **Step 2: Add NEXT_PUBLIC_API_URL for frontend SSE**

在 `.env.frontend` 中确保 `API_URL` 存在（用于 server actions），并添加 `NEXT_PUBLIC_API_URL`（用于客户端 SSE 直连）:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 3: Commit**

```bash
git add .env.backend .env.frontend
git commit -m "chore: 添加 AI 助手环境变量配置"
```

---

## Task 12: End-to-End Smoke Test

- [ ] **Step 1: Rebuild and start**

```bash
docker compose up -d --build
```

- [ ] **Step 2: Run all backend tests**

```bash
docker compose exec api uv run -- pytest . -v
```

Expected: All tests PASS

- [ ] **Step 3: Verify API endpoints**

```bash
# 获取 JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.access')

# 检查额度
curl -s http://localhost:8000/api/ai/usage/ \
  -H "Authorization: Bearer $TOKEN" | jq

# 检查历史
curl -s http://localhost:8000/api/ai/chat/history/ \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected: 200 OK with usage and empty messages

- [ ] **Step 4: Verify frontend**

Open http://localhost:3000, log in, click ✨ AI button, verify panel appears with input box and quota display.

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: 修复集成测试发现的问题"
```

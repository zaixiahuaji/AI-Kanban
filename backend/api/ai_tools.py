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

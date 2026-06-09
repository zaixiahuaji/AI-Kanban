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
                    "description": {
                        "type": "string",
                        "description": "任务详细描述，可选",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                        "description": "优先级，默认 medium",
                    },
                    "status": {
                        "type": "string",
                        "description": "目标列 slug 或名称。不指定则放到第一列。",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "标签名称列表，如 ['bug', '紧急']。不存在的标签会自动创建。",
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
    {
        "type": "function",
        "function": {
            "name": "create_tag",
            "description": "创建一个新标签。如果同名标签已存在则返回错误。",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "标签名称"},
                    "color": {
                        "type": "string",
                        "description": "标签颜色，十六进制格式如 #FF0000，默认 #6B7280",
                    },
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_tag",
            "description": "删除一个标签。这是破坏性操作，需要用户确认。",
            "parameters": {
                "type": "object",
                "properties": {
                    "tag_name": {
                        "type": "string",
                        "description": "要删除的标签名称",
                    },
                },
                "required": ["tag_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "batch_delete_tags",
            "description": "批量删除多个标签。这是破坏性操作，需要用户确认。",
            "parameters": {
                "type": "object",
                "properties": {
                    "tag_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "要删除的标签名称列表",
                    },
                },
                "required": ["tag_names"],
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
    "create_tag": "auto",
    "delete_tag": "confirm",
    "batch_delete_tags": "confirm",
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
    description = args.get("description", "")

    # 确定目标列：优先用指定的，否则取用户的第一个列
    status = args.get("status", "")
    if status:
        col, _ = _resolve_column(user, status)
        if col:
            status = col.slug
        # 如果找不到列，status 保留原值（slug 可能直接有效）
    if not status:
        first_col = BoardColumn.objects.filter(created_by=user).order_by("position").first()
        status = first_col.slug if first_col else "todo"

    task = Task.objects.create(
        title=title.strip(),
        description=description,
        priority=priority,
        status=status,
        created_by=user,
    )

    # 处理标签
    tag_names = args.get("tags", [])
    if tag_names:
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(
                name=name, created_by=user,
                defaults={"color": "#6B7280"},
            )
            task.tags.add(tag)

    tag_list = [t.name for t in task.tags.all()]
    return True, {
        "task_id": str(task.id),
        "title": task.title,
        "status": task.status,
        "tags": tag_list,
    }


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


def handle_create_tag(user, args):
    """创建标签"""
    name = args.get("name", "").strip()
    if not name:
        return False, {"error": "标签名称不能为空"}
    color = args.get("color", "#6B7280").strip()
    tag, created = Tag.objects.get_or_create(
        name=name, created_by=user,
        defaults={"color": color},
    )
    if not created:
        return False, {"error": f"标签「{name}」已存在"}
    return True, {"tag_id": str(tag.id), "name": tag.name, "color": tag.color}


def handle_delete_tag(user, args):
    """删除标签（待确认）"""
    name = args.get("tag_name", "")
    tag = Tag.objects.filter(created_by=user, name__icontains=name).first()
    if not tag:
        return False, {"error": f"未找到标签「{name}」"}
    task_count = Task.objects.active().filter(created_by=user, tags=tag).count()
    return True, {
        "tag_name": tag.name,
        "tag_id": str(tag.id),
        "task_count": task_count,
    }


def handle_batch_delete_tags(user, args):
    """批量删除标签（待确认）"""
    names = args.get("tag_names", [])
    if not names:
        return False, {"error": "标签列表不能为空"}
    found = []
    not_found = []
    for name in names:
        tag = Tag.objects.filter(created_by=user, name__icontains=name).first()
        if tag:
            found.append({"name": tag.name, "id": str(tag.id)})
        else:
            not_found.append(name)
    return True, {"found": found, "not_found": not_found}


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
    "create_tag": handle_create_tag,
    "delete_tag": handle_delete_tag,
    "batch_delete_tags": handle_batch_delete_tags,
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
    """确认后：批量移动（从标题重新解析，target_column 需转换为 slug）"""
    titles = tool_args.get("task_titles", [])
    target_name = tool_args.get("target_column", "")
    # AI 传入的是列名，需要转换为 slug
    col, err = _resolve_column(user, target_name)
    if err:
        return False, {"error": err}
    target_slug = col.slug
    moved = []
    for title in titles:
        task = (
            Task.objects.active()
            .filter(created_by=user, title__icontains=title)
            .first()
        )
        if task:
            previous_status = task.status
            task.status = target_slug
            task.save(update_fields=["status", "modified_at"])
            moved.append({"title": task.title, "previous_status": previous_status})
    return True, {"moved": moved, "target_column": target_slug}


def execute_batch_delete_tasks(user, tool_args):
    """确认后：批量软删除（从标题重新解析）"""
    titles = tool_args.get("task_titles", [])
    deleted = []
    for title in titles:
        task = (
            Task.objects.active()
            .filter(created_by=user, title__icontains=title)
            .first()
        )
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


def execute_delete_tag(user, tool_args):
    """确认后：删除标签"""
    tag = Tag.objects.filter(id=tool_args.get("tag_id"), created_by=user).first()
    if not tag:
        return False, {"error": "标签不存在"}
    tag_name = tag.name
    tag.delete()
    return True, {"deleted": True, "tag_name": tag_name}


def execute_batch_delete_tags(user, tool_args):
    """确认后：批量删除标签"""
    found = tool_args.get("found", [])
    deleted = []
    for item in found:
        tag = Tag.objects.filter(id=item.get("id"), created_by=user).first()
        if tag:
            deleted.append(tag.name)
            tag.delete()
    return True, {"deleted": deleted}


CONFIRM_EXECUTORS = {
    "delete_task": execute_delete_task,
    "batch_move_tasks": execute_batch_move_tasks,
    "batch_delete_tasks": execute_batch_delete_tasks,
    "delete_column": execute_delete_column,
    "delete_tag": execute_delete_tag,
    "batch_delete_tags": execute_batch_delete_tags,
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


def undo_batch_delete_tasks(user, result_data):
    """撤销批量删除：恢复所有被软删除的任务"""
    deleted_titles = result_data.get("deleted", [])
    if not deleted_titles:
        return False, {"error": "无法撤销：缺少已删除任务列表"}
    restored = []
    for title in deleted_titles:
        task = (
            Task.objects.filter(created_by=user, title__icontains=title, is_deleted=True)
            .order_by("-modified_at")
            .first()
        )
        if task:
            task.is_deleted = False
            task.deleted_at = None
            task.save(update_fields=["is_deleted", "deleted_at", "modified_at"])
            restored.append(task.title)
    if not restored:
        return False, {"error": "未找到可恢复的任务"}
    return True, {"undone": True, "restored": restored}


def undo_batch_move_tasks(user, result_data):
    """撤销批量移动：把每个任务移回原列"""
    moved = result_data.get("moved", [])
    if not moved:
        return False, {"error": "无法撤销：缺少移动记录"}
    restored = []
    for item in moved:
        task_title = item.get("title", "")
        previous_status = item.get("previous_status", "")
        if not task_title or not previous_status:
            continue
        task = (
            Task.objects.active()
            .filter(created_by=user, title__icontains=task_title)
            .first()
        )
        if task:
            task.status = previous_status
            task.save(update_fields=["status", "modified_at"])
            restored.append(task.title)
    if not restored:
        return False, {"error": "未找到可恢复的任务"}
    return True, {"undone": True, "restored": restored}


def undo_delete_column(user, result_data):
    """撤销删除列：列已被硬删除，无法恢复列本身，但可以恢复其下的软删除任务"""
    deleted_column_name = result_data.get("deleted_column")
    if not deleted_column_name:
        return False, {"error": "无法撤销：缺少列名"}
    # 列已被硬删除，恢复该列下被软删除的任务到第一列
    first_col = BoardColumn.objects.filter(created_by=user).order_by("position").first()
    if not first_col:
        return False, {"error": "无法撤销：没有可用的列"}
    restored = list(
        Task.objects.filter(created_by=user, is_deleted=True).values_list("title", flat=True)
    )
    if restored:
        Task.objects.filter(created_by=user, is_deleted=True).update(
            is_deleted=False, deleted_at=None, status=first_col.slug
        )
    return True, {
        "undone": True,
        "restored_tasks": len(restored),
        "moved_to": first_col.name,
        "note": f"列「{deleted_column_name}」已被删除，任务已恢复到「{first_col.name}」",
    }


def undo_create_tag(user, tool_args):
    """撤销创建标签：删除标签"""
    tag_id = tool_args.get("tag_id")
    if not tag_id:
        return False, {"error": "无法撤销：缺少标签 ID"}
    tag = Tag.objects.filter(id=tag_id, created_by=user).first()
    if not tag:
        return False, {"error": "标签不存在"}
    tag.delete()
    return True, {"undone": True, "tag_name": tag.name}


def undo_delete_tag(user, result_data):
    """撤销删除标签：重新创建标签"""
    tag_name = result_data.get("tag_name")
    if not tag_name:
        return False, {"error": "无法撤销：缺少标签名称"}
    tag, created = Tag.objects.get_or_create(
        name=tag_name, created_by=user,
        defaults={"color": "#6B7280"},
    )
    if not created:
        return False, {"error": f"标签「{tag_name}」已存在"}
    return True, {"undone": True, "tag_name": tag.name}


def undo_batch_delete_tags(user, result_data):
    """撤销批量删除标签：重新创建所有标签"""
    deleted = result_data.get("deleted", [])
    if not deleted:
        return False, {"error": "无法撤销：缺少已删除标签列表"}
    restored = []
    for name in deleted:
        tag, _ = Tag.objects.get_or_create(
            name=name, created_by=user,
            defaults={"color": "#6B7280"},
        )
        restored.append(name)
    return True, {"undone": True, "restored": restored}


UNDO_HANDLERS = {
    "create_task": undo_create_task,
    "move_task": undo_move_task,
    "create_column": undo_create_column,
    "delete_task": undo_delete_task,
    "batch_delete_tasks": undo_batch_delete_tasks,
    "batch_move_tasks": undo_batch_move_tasks,
    "delete_column": undo_delete_column,
    "create_tag": undo_create_tag,
    "delete_tag": undo_delete_tag,
    "batch_delete_tags": undo_batch_delete_tags,
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

    return f"""你是一个看板任务管理助手。

当前看板状态:
- 列:{column_summary}
- 标签: {tag_names or '无'}
- 总任务数: {total_tasks}个

## 核心规则

1. **必须直接调用工具** — 用户的任何操作请求（查看、创建、修改、删除任务/列/标签）都必须通过调用工具完成，绝不能只用文字描述结果或假装已执行。
2. **不要口头确认后再操作** — 当用户要求执行操作时，直接调用工具。不要先问"确认吗？"或"是否继续？"。危险操作系统会自动弹出确认按钮。
3. 简短确认 — 工具调用完成后，用一两句中文确认操作结果。
4. 不要猜测 — 如果不确定用户意图，追问而不是假设。
5. 只做用户要求的 — 不要执行用户没有明确请求的操作。
6. 用中文回复。
7. 不要提及工具名称或技术细节。

## 何时使用哪个工具

### 任务操作
- 查看/列出任务 → list_tasks
- 创建任务 → create_task
- 移动任务 → move_task
- 删除任务 → delete_task
- 批量移动任务 → batch_move_tasks
- 批量删除任务 → batch_delete_tasks

### 列操作
- 查看列 → list_columns
- 创建列 → create_column
- 调整列顺序 → reorder_columns
- 删除列 → delete_column

### 标签操作
- 创建标签 → create_tag
- 删除标签 → delete_tag
- 批量删除标签 → batch_delete_tags
- 给任务添加标签 → add_tag_to_task
- 给任务添加多个标签 → add_tags_to_task"""


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

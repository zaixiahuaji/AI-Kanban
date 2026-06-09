# AI 标签工具 + System Prompt 优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI 助手新增 5 个标签管理工具（创建、删除、批量删除、添加单个/多个标签到任务），并优化 system prompt 解决 AI 不使用工具和双重确认问题。

**Architecture:** 遵循现有 `ai_tools.py` 的注册模式：TOOL_SCHEMAS → TOOL_SAFETY → TOOL_HANDLERS → CONFIRM_EXECUTORS → UNDO_HANDLERS。同时优化 `build_system_prompt` 函数中的提示词。

**Tech Stack:** Django ORM、OpenAI function calling format

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/api/ai_tools.py` | 修改 | 新增 5 个工具的 schema/handler/executor/undo + 优化 system prompt |
| `backend/api/ai_views.py` | 修改 | `_undo_from_result` 集合添加新工具名 |

---

### Task 1: 优化 system prompt，解决双重确认和工具使用率问题

**Files:**
- Modify: `backend/api/ai_tools.py:748-775`（`build_system_prompt` 函数的返回值）

- [ ] **Step 1: 替换 system prompt**

将 `build_system_prompt` 函数中的 return 语句（第 748-775 行）替换为：

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/ai_tools.py
git commit -m "feat: 优化 AI system prompt，强化工具调用并消除双重确认"
```

---

### Task 2: 新增 create_tag 工具

**Files:**
- Modify: `backend/api/ai_tools.py`

- [ ] **Step 1: 在 TOOL_SCHEMAS 列表末尾（第 216 行 `]` 之前）添加 create_tag schema**

```python
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
```

- [ ] **Step 2: 在 TOOL_SAFETY 字典中添加**

```python
    "create_tag": "auto",
```

- [ ] **Step 3: 在 handle_delete_column 函数之后（第 481 行后）添加 handler**

```python
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
```

- [ ] **Step 4: 在 TOOL_HANDLERS 字典中添加**

```python
    "create_tag": handle_create_tag,
```

- [ ] **Step 5: 在 undo_delete_column 函数之后（第 714 行后）添加 undo handler**

```python
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
```

- [ ] **Step 6: 在 UNDO_HANDLERS 字典中添加**

```python
    "create_tag": undo_create_tag,
```

- [ ] **Step 7: Commit**

```bash
git add backend/api/ai_tools.py
git commit -m "feat: AI 工具新增 create_tag"
```

---

### Task 3: 新增 delete_tag 和 batch_delete_tags 工具

**Files:**
- Modify: `backend/api/ai_tools.py`

- [ ] **Step 1: 在 TOOL_SCHEMAS 末尾添加两个 schema**

```python
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
```

- [ ] **Step 2: 在 TOOL_SAFETY 中添加**

```python
    "delete_tag": "confirm",
    "batch_delete_tags": "confirm",
```

- [ ] **Step 3: 添加 handlers（在 handle_create_tag 之后）**

```python
def handle_delete_tag(user, args):
    """删除标签（待确认）"""
    name = args.get("tag_name", "")
    tag = Tag.objects.filter(created_by=user, name__icontains=name).first()
    if not tag:
        return False, {"error": f"未找到标签「{name}」"}
    # 统计关联任务数
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
```

- [ ] **Step 4: 添加 confirm executors（在 CONFIRM_EXECUTORS 之前）**

```python
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
```

- [ ] **Step 5: 在 TOOL_HANDLERS、CONFIRM_EXECUTORS 中添加**

TOOL_HANDLERS:
```python
    "delete_tag": handle_delete_tag,
    "batch_delete_tags": handle_batch_delete_tags,
```

CONFIRM_EXECUTORS:
```python
    "delete_tag": execute_delete_tag,
    "batch_delete_tags": execute_batch_delete_tags,
```

- [ ] **Step 6: 添加 undo handlers（在 undo_create_tag 之后）**

```python
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
```

- [ ] **Step 7: 在 UNDO_HANDLERS 中添加**

```python
    "delete_tag": undo_delete_tag,
    "batch_delete_tags": undo_batch_delete_tags,
```

- [ ] **Step 8: Commit**

```bash
git add backend/api/ai_tools.py
git commit -m "feat: AI 工具新增 delete_tag 和 batch_delete_tags"
```

---

### Task 4: 新增 add_tag_to_task 和 add_tags_to_task 工具

**Files:**
- Modify: `backend/api/ai_tools.py`

- [ ] **Step 1: 在 TOOL_SCHEMAS 末尾添加两个 schema**

```python
    {
        "type": "function",
        "function": {
            "name": "add_tag_to_task",
            "description": "给一个已有任务添加一个标签。标签不存在时会自动创建。",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_title": {
                        "type": "string",
                        "description": "任务标题（模糊匹配）",
                    },
                    "tag_name": {
                        "type": "string",
                        "description": "要添加的标签名称",
                    },
                },
                "required": ["task_title", "tag_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_tags_to_task",
            "description": "给一个已有任务添加多个标签。不存在的标签会自动创建。",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_title": {
                        "type": "string",
                        "description": "任务标题（模糊匹配）",
                    },
                    "tag_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "要添加的标签名称列表",
                    },
                },
                "required": ["task_title", "tag_names"],
            },
        },
    },
```

- [ ] **Step 2: 在 TOOL_SAFETY 中添加**

```python
    "add_tag_to_task": "auto",
    "add_tags_to_task": "auto",
```

- [ ] **Step 3: 添加 handlers（在 handle_batch_delete_tags 之后）**

```python
def handle_add_tag_to_task(user, args):
    """给任务添加一个标签"""
    task, err = _resolve_task(user, args.get("task_title", ""))
    if err:
        return False, {"error": err}
    tag_name = args.get("tag_name", "").strip()
    if not tag_name:
        return False, {"error": "标签名称不能为空"}
    tag, _ = Tag.objects.get_or_create(
        name=tag_name, created_by=user,
        defaults={"color": "#6B7280"},
    )
    if task.tags.filter(id=tag.id).exists():
        return False, {"error": f"任务已有标签「{tag_name}」"}
    task.tags.add(tag)
    return True, {
        "task_title": task.title,
        "tag_name": tag.name,
        "task_id": str(task.id),
        "tag_id": str(tag.id),
    }


def handle_add_tags_to_task(user, args):
    """给任务添加多个标签"""
    task, err = _resolve_task(user, args.get("task_title", ""))
    if err:
        return False, {"error": err}
    tag_names = args.get("tag_names", [])
    if not tag_names:
        return False, {"error": "标签列表不能为空"}
    added = []
    skipped = []
    for name in tag_names:
        name = name.strip()
        if not name:
            continue
        tag, _ = Tag.objects.get_or_create(
            name=name, created_by=user,
            defaults={"color": "#6B7280"},
        )
        if task.tags.filter(id=tag.id).exists():
            skipped.append(name)
        else:
            task.tags.add(tag)
            added.append(name)
    return True, {
        "task_title": task.title,
        "added": added,
        "skipped": skipped,
        "task_id": str(task.id),
    }
```

- [ ] **Step 4: 在 TOOL_HANDLERS 中添加**

```python
    "add_tag_to_task": handle_add_tag_to_task,
    "add_tags_to_task": handle_add_tags_to_task,
```

- [ ] **Step 5: 添加 undo handlers（在 undo_batch_delete_tags 之后）**

```python
def undo_add_tag_to_task(user, tool_args):
    """撤销添加标签：从任务上移除标签"""
    task_id = tool_args.get("task_id")
    tag_id = tool_args.get("tag_id")
    if not task_id or not tag_id:
        return False, {"error": "无法撤销：缺少任务或标签 ID"}
    task = Task.objects.filter(id=task_id, created_by=user).first()
    if not task:
        return False, {"error": "任务不存在"}
    tag = Tag.objects.filter(id=tag_id, created_by=user).first()
    if not tag:
        return False, {"error": "标签不存在"}
    task.tags.remove(tag)
    return True, {"undone": True, "task_title": task.title, "removed_tag": tag.name}


def undo_add_tags_to_task(user, tool_args):
    """撤销批量添加标签：从任务上移除所有已添加的标签"""
    task_id = tool_args.get("task_id")
    added = tool_args.get("added", [])
    if not task_id or not added:
        return False, {"error": "无法撤销：缺少任务 ID 或添加记录"}
    task = Task.objects.filter(id=task_id, created_by=user).first()
    if not task:
        return False, {"error": "任务不存在"}
    removed = []
    for name in added:
        tag = Tag.objects.filter(name=name, created_by=user).first()
        if tag:
            task.tags.remove(tag)
            removed.append(name)
    return True, {"undone": True, "task_title": task.title, "removed_tags": removed}
```

- [ ] **Step 6: 在 UNDO_HANDLERS 中添加**

```python
    "add_tag_to_task": undo_add_tag_to_task,
    "add_tags_to_task": undo_add_tags_to_task,
```

- [ ] **Step 7: Commit**

```bash
git add backend/api/ai_tools.py
git commit -m "feat: AI 工具新增 add_tag_to_task 和 add_tags_to_task"
```

---

### Task 5: 更新 ai_views.py 的 _undo_from_result 集合

**Files:**
- Modify: `backend/api/ai_views.py:423`

- [ ] **Step 1: 更新 _undo_from_result 集合，添加需要从 result 获取数据的标签工具**

将第 423 行：
```python
        _undo_from_result = {"move_task", "batch_delete_tasks", "batch_move_tasks", "delete_column", "delete_task"}
```
替换为：
```python
        _undo_from_result = {"move_task", "batch_delete_tasks", "batch_move_tasks", "delete_column", "delete_task", "delete_tag", "batch_delete_tags"}
```

说明：`delete_tag` 和 `batch_delete_tags` 的 undo handler 需要从 `result` 中获取已删除的标签名称来重建，因此需要加入此集合。

- [ ] **Step 2: Commit**

```bash
git add backend/api/ai_views.py
git commit -m "feat: _undo_from_result 集合新增标签删除工具"
```

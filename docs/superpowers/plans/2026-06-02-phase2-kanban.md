# 第二期实施计划 — 任务看板

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现泳道看板系统，包含任务 CRUD、拖拽、标签管理、回收站。

**Architecture:** 后端 Django REST API 提供 Task/Tag 的 CRUD，前端用 dnd-kit 实现泳道看板拖拽，乐观更新策略。泳道分组纯前端计算。

**Tech Stack:** Django 5.1 / DRF / @dnd-kit/core / @dnd-kit/sortable / react-hook-form / zod / Tailwind CSS / next-intl

**Spec:** [2026-06-02-phase2-kanban-design.md](../specs/2026-06-02-phase2-kanban-design.md) / [第二期-需求文档.md](../../第二期-需求文档.md)

---

## 文件结构总览

### 后端新建文件

| 文件 | 职责 |
|------|------|
| `backend/api/managers.py` | TaskManager（active/deleted 过滤） |
| `backend/api/management/commands/cleanup_expired_tasks.py` | 30 天自动清理命令 |
| `backend/api/tests/test_tasks.py` | 任务 API 测试 |
| `backend/api/tests/test_tags.py` | 标签 API 测试 |

### 后端修改文件

| 文件 | 改动 |
|------|------|
| `backend/api/models.py` | 追加 Tag、Task 模型 |
| `backend/api/serializers.py` | 追加 Task/Tag 相关 Serializer |
| `backend/api/api.py` | 追加 TaskViewSet、TagViewSet |
| `backend/api/urls.py` | 注册 tasks、tags 路由 |

### 前端新建文件

| 文件 | 职责 |
|------|------|
| `frontend/apps/web/app/(dashboard)/layout.tsx` | 带侧边栏的布局 |
| `frontend/apps/web/app/(dashboard)/page.tsx` | 看板主页 |
| `frontend/apps/web/app/(dashboard)/tags/page.tsx` | 标签管理页 |
| `frontend/apps/web/app/(dashboard)/trash/page.tsx` | 回收站页 |
| `frontend/apps/web/components/sidebar.tsx` | 左侧导航栏 |
| `frontend/apps/web/components/kanban/kanban-board.tsx` | 看板主组件 |
| `frontend/apps/web/components/kanban/kanban-column.tsx` | 看板列 |
| `frontend/apps/web/components/kanban/kanban-row.tsx` | 泳道行 |
| `frontend/apps/web/components/kanban/task-card.tsx` | 任务卡片 |
| `frontend/apps/web/components/kanban/task-modal.tsx` | 任务创建/编辑弹窗 |
| `frontend/apps/web/components/kanban/swimlane-toggle.tsx` | 泳道维度切换器 |
| `frontend/apps/web/components/kanban/kanban-filters.tsx` | 筛选栏 |
| `frontend/apps/web/components/tags/tag-list.tsx` | 标签列表 |
| `frontend/apps/web/components/tags/tag-form.tsx` | 标签创建/编辑表单 |
| `frontend/apps/web/components/tags/color-picker.tsx` | 颜色选择器 |
| `frontend/apps/web/components/trash/trash-list.tsx` | 回收站列表 |
| `frontend/apps/web/actions/task-actions.ts` | 任务 Server Actions |
| `frontend/apps/web/actions/tag-actions.ts` | 标签 Server Actions |
| `frontend/apps/web/lib/kanban-utils.ts` | 泳道分组工具函数 |

### 前端修改文件

| 文件 | 改动 |
|------|------|
| `frontend/apps/web/app/layout.tsx` | 简化为纯 provider 包裹，去掉内容容器 |
| `frontend/apps/web/app/page.tsx` | 重定向到看板或显示 landing |
| `frontend/apps/web/lib/validation.ts` | 追加 task/tag 的 Zod schemas |
| `frontend/packages/ui/locales/en.json` | 追加 kanban/tags/trash/sidebar 翻译 |
| `frontend/packages/ui/locales/zh-CN.json` | 同上 |

---

## Task 1: 后端 — TaskManager + Task/Tag 模型

**Files:**
- Create: `backend/api/managers.py`
- Modify: `backend/api/models.py` (追加到文件末尾)

- [ ] **Step 1: 创建 TaskManager**

新建 `backend/api/managers.py`：
```python
from django.db import models


class TaskManager(models.Manager):
    """任务查询管理器，默认排除已删除的任务"""

    def active(self):
        return self.get_queryset().filter(is_deleted=False)

    def deleted(self):
        return self.get_queryset().filter(is_deleted=True)
```

- [ ] **Step 2: 在 models.py 末尾追加 Tag 和 Task 模型**

在 `backend/api/models.py` 文件末尾追加：
```python
class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(_("name"), max_length=50)
    color = models.CharField(_("color"), max_length=7)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tags",
        verbose_name=_("created by"),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    class Meta:
        db_table = "tags"
        unique_together = [("created_by", "name")]
        verbose_name = _("tag")
        verbose_name_plural = _("tags")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Task(models.Model):
    STATUS_CHOICES = [
        ("todo", _("To Do")),
        ("in_progress", _("In Progress")),
        ("done", _("Done")),
    ]
    PRIORITY_CHOICES = [
        ("high", _("High")),
        ("medium", _("Medium")),
        ("low", _("Low")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(_("title"), max_length=200)
    description = models.TextField(_("description"), blank=True, default="")
    status = models.CharField(
        _("status"), max_length=20, choices=STATUS_CHOICES, default="todo"
    )
    priority = models.CharField(
        _("priority"), max_length=10, choices=PRIORITY_CHOICES, default="medium"
    )
    due_date = models.DateField(_("due date"), null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name=_("created by"),
    )
    tags = models.ManyToManyField(Tag, through="TaskTag", blank=True, verbose_name=_("tags"))
    is_deleted = models.BooleanField(_("deleted"), default=False)
    deleted_at = models.DateTimeField(_("deleted at"), null=True, blank=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    objects = TaskManager()

    class Meta:
        db_table = "tasks"
        verbose_name = _("task")
        verbose_name_plural = _("tasks")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_by", "status", "is_deleted"], name="idx_task_status"),
            models.Index(fields=["created_by", "is_deleted", "deleted_at"], name="idx_task_trash"),
            models.Index(fields=["is_deleted", "deleted_at"], name="idx_task_cleanup"),
        ]

    def __str__(self):
        return self.title


class TaskTag(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="task_tags")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="task_tags")
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "task_tags"
        unique_together = [("task", "tag")]
```

注意：需要在 models.py 顶部确保有 `from django.conf import settings`（已有 `from django.contrib.auth import get_user_model`）。

- [ ] **Step 3: 生成并执行迁移**

```bash
docker compose exec api uv run -- python manage.py makemigrations api
docker compose exec api uv run -- python manage.py migrate
```

Expected: 生成 `0003_*.py` 迁移文件，迁移成功。

- [ ] **Step 4: 提交**

```bash
git add backend/api/managers.py backend/api/models.py backend/api/migrations/
git commit -m "feat: 新增 Task、Tag 模型和 TaskManager"
```

---

## Task 2: 后端 — Task/Tag Serializers

**Files:**
- Modify: `backend/api/serializers.py` (追加到文件末尾)

- [ ] **Step 1: 在 serializers.py 末尾追加 Task/Tag serializers**

```python
######################################################################
# Tag
######################################################################


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "color", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        # 检查同一用户下标签名是否重复
        user = self.context["request"].user
        qs = Tag.objects.filter(created_by=user, name=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(_("A tag with this name already exists."))
        return value


class TagBriefSerializer(serializers.ModelSerializer):
    """任务列表中嵌入的标签摘要"""

    class Meta:
        model = Tag
        fields = ["id", "name", "color"]


######################################################################
# Task
######################################################################


class TaskListSerializer(serializers.ModelSerializer):
    tags = TagBriefSerializer(many=True, read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "title", "status", "priority", "priority_display",
            "due_date", "is_overdue", "tags", "created_at", "modified_at",
        ]

    def get_is_overdue(self, obj):
        if obj.due_date and obj.status != "done":
            from datetime import date
            return obj.due_date < date.today()
        return False


class TaskDetailSerializer(TaskListSerializer):
    description = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta(TaskListSerializer.Meta):
        fields = TaskListSerializer.Meta.fields + ["description", "created_by"]


class TaskCreateSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        default=[],
    )

    class Meta:
        model = Task
        fields = ["title", "description", "status", "priority", "due_date", "tags"]

    def validate_title(self, value):
        if len(value.strip()) < 1:
            raise serializers.ValidationError(_("Title cannot be empty."))
        return value.strip()

    def validate_tags(self, value):
        user = self.context["request"].user
        tags = Tag.objects.filter(id__in=value, created_by=user)
        if len(tags) != len(value):
            raise serializers.ValidationError(_("Some tags do not exist or do not belong to you."))
        return tags

    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        validated_data["created_by"] = self.context["request"].user
        task = Task.objects.create(**validated_data)
        if tags:
            task.tags.set(tags)
        return task


class TaskUpdateSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Task
        fields = ["title", "description", "status", "priority", "due_date", "tags"]

    def validate_tags(self, value):
        if value is None:
            return value
        user = self.context["request"].user
        tags = Tag.objects.filter(id__in=value, created_by=user)
        if len(tags) != len(value):
            raise serializers.ValidationError(_("Some tags do not exist or do not belong to you."))
        return tags

    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tags is not None:
            instance.tags.set(tags)
        return instance
```

需要在文件顶部追加导入：
```python
from .models import EmailVerification, Tag, Task
```

- [ ] **Step 2: 提交**

```bash
git add backend/api/serializers.py
git commit -m "feat: 新增 Task/Tag serializers"
```

---

## Task 3: 后端 — TaskViewSet + TagViewSet

**Files:**
- Modify: `backend/api/api.py` (追加到文件末尾)
- Modify: `backend/api/urls.py` (注册新路由)

- [ ] **Step 1: 在 api.py 末尾追加 ViewSet**

```python
######################################################################
# Task & Tag
######################################################################
from django.utils import timezone

from .managers import TaskManager
from .models import Tag, Task
from .permissions import IsOwnerOrAdmin
from .serializers import (
    TagSerializer,
    TaskCreateSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskUpdateSerializer,
)


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        return Tag.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TaskViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        qs = Task.objects.active()
        if not self.request.user.is_staff:
            qs = qs.filter(created_by=self.request.user)
        return qs.select_related("created_by").prefetch_related("tags")

    def get_serializer_class(self):
        if self.action == "list":
            return TaskListSerializer
        if self.action == "retrieve":
            return TaskDetailSerializer
        if self.action == "create":
            return TaskCreateSerializer
        if self.action in ("update", "partial_update"):
            return TaskUpdateSerializer
        return TaskDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @extend_schema(request=TaskUpdateSerializer, responses={200: TaskDetailSerializer})
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @extend_schema(request=TaskUpdateSerializer, responses={200: TaskDetailSerializer})
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """软删除"""
        task = self.get_object()
        task.is_deleted = True
        task.deleted_at = timezone.now()
        task.save(update_fields=["is_deleted", "deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        """从回收站恢复"""
        task = self.get_object()
        if not task.is_deleted:
            return Response(
                {"detail": _("Task is not deleted.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task.is_deleted = False
        task.deleted_at = None
        task.save(update_fields=["is_deleted", "deleted_at"])
        serializer = TaskDetailSerializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=["delete"], url_path="permanent")
    def permanent_destroy(self, request, *args, **kwargs):
        """永久删除"""
        task = self.get_object()
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="trash")
    def trash(self, request):
        """回收站列表"""
        qs = Task.objects.deleted()
        if not request.user.is_staff:
            qs = qs.filter(created_by=request.user)
        qs = qs.select_related("created_by").prefetch_related("tags")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = TaskDetailSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = TaskDetailSerializer(qs, many=True)
        return Response(serializer.data)
```

注意：需要在文件顶部已有的 import 中加入 `timezone` 相关的导入，并确保 `status` 已从 `rest_framework` 导入（已有 `from rest_framework import status`）。

另外 IsOwnerOrAdmin 权限检查的是 `obj.user`，但 Task 模型用的是 `created_by`。需要更新权限类。

- [ ] **Step 2: 更新 IsOwnerOrAdmin 权限类**

修改 `backend/api/permissions.py`，将 `has_object_permission` 中的 `obj.user` 改为同时支持 `user` 和 `created_by`：

```python
from rest_framework.permissions import BasePermission


class IsOwnerOrAdmin(BasePermission):
    """
    普通用户只能操作自己的数据，
    管理员可以操作所有数据。
    支持 obj.user 和 obj.created_by 两种外键名。
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        owner = getattr(obj, "created_by", None) or getattr(obj, "user", None)
        return owner == request.user
```

- [ ] **Step 3: 在 urls.py 注册新路由**

在 `backend/api/urls.py` 中追加导入和路由注册：

追加到 import 区域：
```python
from .api import SendCodeView, UserViewSet, TagViewSet, TaskViewSet
```

在 router 注册区域追加：
```python
router.register("tags", TagViewSet, basename="api-tags")
router.register("tasks", TaskViewSet, basename="api-tasks")
```

- [ ] **Step 4: 提交**

```bash
git add backend/api/api.py backend/api/urls.py backend/api/permissions.py
git commit -m "feat: 新增 Task/Tag ViewSet 和 API 路由"
```

---

## Task 4: 后端 — 重新生成 OpenAPI 类型

**Files:**
- 自动生成: `frontend/packages/types/api/`

- [ ] **Step 1: 重新生成前端 API 类型**

```bash
docker compose exec web pnpm openapi:generate
```

Expected: 生成 `TaskService.ts`、`TagService.ts` 及相关 model 文件。

- [ ] **Step 2: 验证生成的方法名**

检查生成的文件，确认方法名格式（如 `tasksList`、`tasksCreate`、`tasksPartialUpdate`、`tagsList` 等）。

- [ ] **Step 3: 提交**

```bash
git add frontend/packages/types/api/
git commit -m "chore: 重新生成 OpenAPI 前端类型（Task/Tag）"
```

---

## Task 5: 后端 — 清理命令

**Files:**
- Create: `backend/api/management/commands/cleanup_expired_tasks.py`

- [ ] **Step 1: 创建 management command 目录和文件**

先创建目录结构：
```bash
mkdir -p backend/api/management/commands
touch backend/api/management/__init__.py
touch backend/api/management/commands/__init__.py
```

新建 `backend/api/management/commands/cleanup_expired_tasks.py`：
```python
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Task


class Command(BaseCommand):
    help = "Permanently delete tasks that have been in trash for more than 30 days"

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)
        result = Task.objects.deleted().filter(deleted_at__lt=cutoff).delete()
        count = result[0]
        self.stdout.write(self.style.SUCCESS(f"Successfully cleaned up {count} expired tasks"))
```

- [ ] **Step 2: 测试命令**

```bash
docker compose exec api uv run -- python manage.py cleanup_expired_tasks
```

Expected: `Successfully cleaned up 0 expired tasks`

- [ ] **Step 3: 提交**

```bash
git add backend/api/management/
git commit -m "feat: 新增 30 天过期任务自动清理命令"
```

---

## Task 6: 后端 — 测试

**Files:**
- Modify: `backend/api/tests/factories.py` (追加 TagFactory)
- Create: `backend/api/tests/test_tasks.py`
- Create: `backend/api/tests/test_tags.py`

- [ ] **Step 1: 在 factories.py 末尾追加 TagFactory**

```python
class TagFactory(DjangoModelFactory):
    name = Sequence(lambda n: f"tag_{n}")
    color = "#3B82F6"
    created_by = SubFactory(UserFactory)

    class Meta:
        model = Tag
```

需要在顶部追加导入：
```python
from factory.django import DjangoModelFactory, SubFactory
from api.models import Tag
```

- [ ] **Step 2: 创建 test_tags.py**

新建 `backend/api/tests/test_tags.py`：
```python
import pytest
from api.models import Tag


@pytest.mark.django_db
def test_tag_create(client, regular_user):
    """测试创建标签"""
    client.force_login(regular_user)
    response = client.post(
        "/api/tags/",
        {"name": "bug", "color": "#EF4444"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "bug"
    assert response.data["color"] == "#EF4444"


@pytest.mark.django_db
def test_tag_list_only_mine(client, regular_user, admin_user):
    """测试只能看到自己的标签"""
    Tag.objects.create(name="user_tag", color="#000", created_by=regular_user)
    Tag.objects.create(name="admin_tag", color="#000", created_by=admin_user)

    client.force_login(regular_user)
    response = client.get("/api/tags/")
    assert response.status_code == 200
    names = [t["name"] for t in response.data["results"]]
    assert "user_tag" in names
    assert "admin_tag" not in names


@pytest.mark.django_db
def test_tag_duplicate_name(client, regular_user):
    """测试同一用户不能创建重复名称标签"""
    Tag.objects.create(name="bug", color="#EF4444", created_by=regular_user)
    client.force_login(regular_user)
    response = client.post(
        "/api/tags/",
        {"name": "bug", "color": "#22C55E"},
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_tag_delete(client, regular_user):
    """测试删除标签"""
    tag = Tag.objects.create(name="bug", color="#EF4444", created_by=regular_user)
    client.force_login(regular_user)
    response = client.delete(f"/api/tags/{tag.id}/")
    assert response.status_code == 204
    assert not Tag.objects.filter(id=tag.id).exists()
```

- [ ] **Step 3: 创建 test_tasks.py**

新建 `backend/api/tests/test_tasks.py`：
```python
from datetime import timedelta

import pytest
from django.utils import timezone

from api.models import Tag, Task


@pytest.mark.django_db
def test_task_create(client, regular_user):
    """测试创建任务"""
    client.force_login(regular_user)
    response = client.post(
        "/api/tasks/",
        {"title": "测试任务", "priority": "high"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["title"] == "测试任务"
    assert response.data["status"] == "todo"
    assert response.data["priority"] == "high"


@pytest.mark.django_db
def test_task_create_with_tags(client, regular_user):
    """测试创建任务带标签"""
    tag = Tag.objects.create(name="bug", color="#EF4444", created_by=regular_user)
    client.force_login(regular_user)
    response = client.post(
        "/api/tasks/",
        {"title": "修复 bug", "priority": "high", "tags": [str(tag.id)]},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert len(response.data["tags"]) == 1
    assert response.data["tags"][0]["name"] == "bug"


@pytest.mark.django_db
def test_task_list_only_mine(client, regular_user, admin_user):
    """测试普通用户只看到自己的任务"""
    Task.objects.create(title="我的任务", created_by=regular_user)
    Task.objects.create(title="管理员任务", created_by=admin_user)

    client.force_login(regular_user)
    response = client.get("/api/tasks/")
    assert response.status_code == 200
    titles = [t["title"] for t in response.data["results"]]
    assert "我的任务" in titles
    assert "管理员任务" not in titles


@pytest.mark.django_db
def test_task_admin_sees_all(api_client, admin_user, regular_user):
    """测试管理员看到所有任务"""
    Task.objects.create(title="用户任务", created_by=regular_user)
    Task.objects.create(title="管理员任务", created_by=admin_user)

    api_client.force_authenticate(admin_user)
    response = api_client.get("/api/tasks/")
    assert response.status_code == 200
    titles = [t["title"] for t in response.data["results"]]
    assert "用户任务" in titles
    assert "管理员任务" in titles


@pytest.mark.django_db
def test_task_soft_delete(client, regular_user):
    """测试软删除"""
    task = Task.objects.create(title="要删除的任务", created_by=regular_user)
    client.force_login(regular_user)
    response = client.delete(f"/api/tasks/{task.id}/")
    assert response.status_code == 204

    # 任务仍然存在但标记为已删除
    task.refresh_from_db()
    assert task.is_deleted is True
    assert task.deleted_at is not None

    # 不再出现在正常列表中
    response = client.get("/api/tasks/")
    titles = [t["title"] for t in response.data["results"]]
    assert "要删除的任务" not in titles


@pytest.mark.django_db
def test_task_restore(client, regular_user):
    """测试从回收站恢复"""
    task = Task.objects.create(
        title="恢复的任务", created_by=regular_user, is_deleted=True,
        deleted_at=timezone.now()
    )
    client.force_login(regular_user)
    response = client.post(f"/api/tasks/{task.id}/restore/")
    assert response.status_code == 200

    task.refresh_from_db()
    assert task.is_deleted is False
    assert task.deleted_at is None


@pytest.mark.django_db
def test_task_trash_list(client, regular_user):
    """测试回收站列表"""
    Task.objects.create(title="正常任务", created_by=regular_user)
    Task.objects.create(
        title="已删除任务", created_by=regular_user, is_deleted=True,
        deleted_at=timezone.now()
    )
    client.force_login(regular_user)
    response = client.get("/api/tasks/trash/")
    assert response.status_code == 200
    titles = [t["title"] for t in response.data["results"]]
    assert "已删除任务" in titles
    assert "正常任务" not in titles


@pytest.mark.django_db
def test_task_permanent_delete(client, regular_user):
    """测试永久删除"""
    task = Task.objects.create(
        title="永久删除", created_by=regular_user, is_deleted=True,
        deleted_at=timezone.now()
    )
    client.force_login(regular_user)
    response = client.delete(f"/api/tasks/{task.id}/permanent/")
    assert response.status_code == 204
    assert not Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
def test_task_patch_status(client, regular_user):
    """测试拖拽更新状态"""
    task = Task.objects.create(title="拖拽任务", created_by=regular_user)
    client.force_login(regular_user)
    response = client.patch(
        f"/api/tasks/{task.id}/",
        {"status": "in_progress"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["status"] == "in_progress"


@pytest.mark.django_db
def test_cleanup_expired_tasks(regular_user):
    """测试 30 天自动清理"""
    from django.core.management import call_command

    # 创建 31 天前删除的任务
    Task.objects.create(
        title="过期任务", created_by=regular_user, is_deleted=True,
        deleted_at=timezone.now() - timedelta(days=31)
    )
    # 创建 10 天前删除的任务
    Task.objects.create(
        title="未过期任务", created_by=regular_user, is_deleted=True,
        deleted_at=timezone.now() - timedelta(days=10)
    )

    call_command("cleanup_expired_tasks")

    assert Task.objects.filter(title="过期任务").exists() is False
    assert Task.objects.filter(title="未过期任务").exists() is True
```

- [ ] **Step 4: 运行全部测试**

```bash
docker compose exec api uv run -- pytest . -v
```

Expected: 所有旧测试 + 新测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/api/tests/
git commit -m "test: 新增 Task/Tag API 测试"
```

---

## Task 7: 前端 — 安装依赖

**Files:**
- Modify: `frontend/apps/web/package.json`

- [ ] **Step 1: 安装 dnd-kit**

```bash
docker compose exec web pnpm --filter web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: 提交**

```bash
git add frontend/apps/web/package.json frontend/pnpm-lock.yaml
git commit -m "chore: 安装 @dnd-kit/core 拖拽库"
```

---

## Task 8: 前端 — i18n 翻译 + Validation

**Files:**
- Modify: `frontend/packages/ui/locales/en.json`
- Modify: `frontend/packages/ui/locales/zh-CN.json`
- Modify: `frontend/apps/web/lib/validation.ts`

- [ ] **Step 1: 在两个翻译文件中追加 kanban/tags/trash/sidebar 命名空间**

在 `en.json` 的 `home` 对象后面追加（`home` 对象的 `}` 后面，最外层 `}` 前面）：

```json
  "sidebar": {
    "kanban": "Kanban",
    "tags": "Tags",
    "trash": "Trash",
    "admin": "Admin",
    "logout": "Logout",
    "logoutConfirm": "Are you sure you want to logout?"
  },
  "kanban": {
    "title": "Kanban",
    "addTask": "Add task",
    "todo": "To Do",
    "inProgress": "In Progress",
    "done": "Done",
    "noTasks": "No tasks",
    "swimlane": "Group by",
    "swimlaneNone": "None",
    "swimlaneTag": "Tag",
    "swimlanePriority": "Priority",
    "priorityHigh": "High",
    "priorityMedium": "Medium",
    "priorityLow": "Low",
    "untagged": "Untagged",
    "searchPlaceholder": "Search tasks...",
    "filterPriority": "Priority",
    "filterAll": "All",
    "deleteConfirm": "Delete this task?",
    "taskTitle": "Title",
    "taskTitlePlaceholder": "Task title",
    "taskDescription": "Description",
    "taskDescriptionPlaceholder": "Add a description...",
    "taskPriority": "Priority",
    "taskDueDate": "Due date",
    "taskTags": "Tags",
    "taskStatus": "Status",
    "createTask": "Create Task",
    "editTask": "Edit Task",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "overdue": "Overdue",
    "restoreSuccess": "Task restored",
    "deleteSuccess": "Task deleted"
  },
  "tags": {
    "title": "Tags",
    "addTag": "Add tag",
    "editTag": "Edit tag",
    "tagName": "Tag name",
    "tagNamePlaceholder": "Enter tag name",
    "tagColor": "Color",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "deleteConfirm": "Delete this tag? It will be removed from all tasks.",
    "taskCount": "{count} tasks"
  },
  "trash": {
    "title": "Trash",
    "empty": "Trash is empty",
    "restore": "Restore",
    "permanentDelete": "Delete permanently",
    "permanentDeleteConfirm": "This action cannot be undone. Permanently delete this task?",
    "taskTitle": "Title",
    "taskStatus": "Status",
    "deletedAt": "Deleted at",
    "actions": "Actions",
    "restoreSuccess": "Task restored",
    "deleteSuccess": "Task permanently deleted"
  }
```

在 `zh-CN.json` 同样位置追加对应的中文翻译：

```json
  "sidebar": {
    "kanban": "看板",
    "tags": "标签",
    "trash": "回收站",
    "admin": "管理后台",
    "logout": "退出登录",
    "logoutConfirm": "确定退出登录吗？"
  },
  "kanban": {
    "title": "看板",
    "addTask": "添加任务",
    "todo": "待办",
    "inProgress": "进行中",
    "done": "已完成",
    "noTasks": "暂无任务",
    "swimlane": "分组",
    "swimlaneNone": "无",
    "swimlaneTag": "标签",
    "swimlanePriority": "优先级",
    "priorityHigh": "高",
    "priorityMedium": "中",
    "priorityLow": "低",
    "untagged": "未分类",
    "searchPlaceholder": "搜索任务...",
    "filterPriority": "优先级",
    "filterAll": "全部",
    "deleteConfirm": "确认删除此任务？",
    "taskTitle": "标题",
    "taskTitlePlaceholder": "任务标题",
    "taskDescription": "描述",
    "taskDescriptionPlaceholder": "添加描述...",
    "taskPriority": "优先级",
    "taskDueDate": "截止日期",
    "taskTags": "标签",
    "taskStatus": "状态",
    "createTask": "创建任务",
    "editTask": "编辑任务",
    "save": "保存",
    "cancel": "取消",
    "delete": "删除",
    "overdue": "已过期",
    "restoreSuccess": "任务已恢复",
    "deleteSuccess": "任务已删除"
  },
  "tags": {
    "title": "标签管理",
    "addTag": "添加标签",
    "editTag": "编辑标签",
    "tagName": "标签名称",
    "tagNamePlaceholder": "输入标签名称",
    "tagColor": "颜色",
    "save": "保存",
    "cancel": "取消",
    "delete": "删除",
    "deleteConfirm": "删除此标签？它将从所有任务中移除。",
    "taskCount": "{count} 个任务"
  },
  "trash": {
    "title": "回收站",
    "empty": "回收站为空",
    "restore": "恢复",
    "permanentDelete": "永久删除",
    "permanentDeleteConfirm": "此操作不可撤销，确认永久删除？",
    "taskTitle": "标题",
    "taskStatus": "状态",
    "deletedAt": "删除时间",
    "actions": "操作",
    "restoreSuccess": "任务已恢复",
    "deleteSuccess": "任务已永久删除"
  }
```

- [ ] **Step 2: 在 validation.ts 末尾追加 task/tag schemas**

在 `frontend/apps/web/lib/validation.ts` 文件末尾，`export {` 之前追加：

```ts
const taskFormSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

const tagFormSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})
```

并在 export 块中追加 `taskFormSchema` 和 `tagFormSchema`。

- [ ] **Step 3: 提交**

```bash
git add frontend/packages/ui/locales/ frontend/apps/web/lib/validation.ts
git commit -m "feat: 新增看板/标签/回收站 i18n 翻译和验证 schemas"
```

---

## Task 9: 前端 — Dashboard 布局 + 侧边栏

**Files:**
- Create: `frontend/apps/web/components/sidebar.tsx`
- Create: `frontend/apps/web/app/(dashboard)/layout.tsx`
- Modify: `frontend/apps/web/app/layout.tsx`
- Modify: `frontend/apps/web/app/page.tsx`

- [ ] **Step 1: 创建侧边栏组件**

新建 `frontend/apps/web/components/sidebar.tsx`（客户端组件，包含导航链接、语言切换、用户信息）。

核心结构：
```tsx
'use client'
// 导航项：看板(/)、标签(/tags)、回收站(/trash)
// 管理员入口：Admin（仅 isStaff 可见）
// 底部：语言切换 + 退出登录
```

- [ ] **Step 2: 创建 dashboard layout**

新建 `frontend/apps/web/app/(dashboard)/layout.tsx`：
```tsx
import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: 修改根 layout**

简化 `app/layout.tsx`，移除内容容器（容器移到各子布局中）。保留 `NextIntlClientProvider` 和 `AuthProvider` 包裹。

- [ ] **Step 4: 修改首页**

将 `app/page.tsx` 改为重定向到看板：
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/')
}
```

或者直接把看板放在 `(dashboard)/page.tsx`，而根 `page.tsx` 保留 landing 或 redirect。

- [ ] **Step 5: 验证页面渲染**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```

Expected: 200（dashboard layout 带侧边栏渲染成功）。

注意：修改后需 `docker compose restart web` 使 server action 变更生效。

- [ ] **Step 6: 提交**

```bash
git add frontend/apps/web/components/sidebar.tsx frontend/apps/web/app/(dashboard)/ frontend/apps/web/app/layout.tsx frontend/apps/web/app/page.tsx
git commit -m "feat: 新增 dashboard 布局和侧边栏导航"
```

---

## Task 10: 前端 — Server Actions

**Files:**
- Create: `frontend/apps/web/actions/task-actions.ts`
- Create: `frontend/apps/web/actions/tag-actions.ts`

- [ ] **Step 1: 创建 task-actions.ts**

封装任务的 CRUD Server Actions。核心函数：
- `getTasks()` — 获取任务列表
- `createTask(data)` — 创建任务
- `updateTask(id, data)` — 更新任务（含拖拽改状态）
- `deleteTask(id)` — 软删除
- `restoreTask(id)` — 恢复
- `permanentDeleteTask(id)` — 永久删除
- `getTrashTasks()` — 获取回收站列表

每个函数使用 `getApiClient()` 调用生成的 API 方法。方法名以 Task 4 生成为准。

- [ ] **Step 2: 创建 tag-actions.ts**

封装标签的 CRUD Server Actions：
- `getTags()` — 获取标签列表
- `createTag(data)` — 创建标签
- `updateTag(id, data)` — 更新标签
- `deleteTag(id)` — 删除标签

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/actions/task-actions.ts frontend/apps/web/actions/tag-actions.ts
git commit -m "feat: 新增 Task/Tag Server Actions"
```

---

## Task 11: 前端 — 看板核心组件

**Files:**
- Create: `frontend/apps/web/lib/kanban-utils.ts`
- Create: `frontend/apps/web/components/kanban/task-card.tsx`
- Create: `frontend/apps/web/components/kanban/kanban-column.tsx`
- Create: `frontend/apps/web/components/kanban/kanban-row.tsx`
- Create: `frontend/apps/web/components/kanban/kanban-board.tsx`
- Create: `frontend/apps/web/components/kanban/swimlane-toggle.tsx`
- Create: `frontend/apps/web/components/kanban/kanban-filters.tsx`

这是最大的一组任务，包含看板的核心渲染和拖拽逻辑。各组件职责：

- **kanban-utils.ts**: 泳道分组函数 `groupTasksByDimension()`
- **task-card.tsx**: 可拖拽的任务卡片，显示标题/标签/优先级/截止日期
- **kanban-column.tsx**: 单列（todo/in_progress/done），Droppable 容器
- **kanban-row.tsx**: 泳道行，包含行标题和三列
- **kanban-board.tsx**: 主组件，编排 DndContext + 泳道 + 列
- **swimlane-toggle.tsx**: 维度切换按钮组
- **kanban-filters.tsx**: 搜索框 + 优先级筛选

拖拽核心逻辑在 kanban-board.tsx 中：
- `DndContext` 包裹整个看板
- `onDragStart` → 记录拖拽源
- `onDragOver` → 更新本地状态（乐观更新列位置）
- `onDragEnd` → 调用 Server Action PATCH 更新状态，失败则回滚

- [ ] **Step 1: 逐个创建组件文件，实现看板渲染和拖拽**

- [ ] **Step 2: 在浏览器中验证看板渲染**

打开 `http://localhost:3000/`，确认：
- 三列显示（待办/进行中/已完成）
- 任务卡片正确渲染
- 拖拽可改变任务状态列

注意：修改后需 `docker compose restart web`。

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/lib/kanban-utils.ts frontend/apps/web/components/kanban/
git commit -m "feat: 新增看板核心组件（拖拽+泳道+筛选）"
```

---

## Task 12: 前端 — 任务弹窗

**Files:**
- Create: `frontend/apps/web/components/kanban/task-modal.tsx`

- [ ] **Step 1: 创建任务创建/编辑弹窗**

模态弹窗组件，包含：
- 标题输入（必填）
- 描述多行文本
- 优先级单选（高/中/低）
- 截止日期选择器
- 标签多选下拉
- 状态下拉
- 保存/取消按钮

使用 react-hook-form + zod 验证。创建和编辑复用同一组件，通过 props 区分模式。

- [ ] **Step 2: 在看板页面中集成弹窗**

在看板页面顶部添加「+ 添加任务」按钮，点击打开弹窗。任务卡片点击打开编辑弹窗。

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/components/kanban/task-modal.tsx
git commit -m "feat: 新增任务创建/编辑弹窗"
```

---

## Task 13: 前端 — 看板主页

**Files:**
- Create: `frontend/apps/web/app/(dashboard)/page.tsx`

- [ ] **Step 1: 创建看板主页**

组合 kanban-board + swimlane-toggle + kanban-filters + task-modal。页面加载时获取任务和标签数据。

- [ ] **Step 2: 验证完整看板功能**

- 创建任务 → 出现在待办列
- 拖拽到进行中 → 状态更新
- 点击卡片 → 弹出编辑弹窗
- 删除任务 → 消失，出现在回收站

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/app/(dashboard)/page.tsx
git commit -m "feat: 新增看板主页"
```

---

## Task 14: 前端 — 标签管理页

**Files:**
- Create: `frontend/apps/web/components/tags/color-picker.tsx`
- Create: `frontend/apps/web/components/tags/tag-form.tsx`
- Create: `frontend/apps/web/components/tags/tag-list.tsx`
- Create: `frontend/apps/web/app/(dashboard)/tags/page.tsx`

- [ ] **Step 1: 创建颜色选择器、标签表单、标签列表组件**

- **color-picker.tsx**: 9 个预设颜色的圆形选择器
- **tag-form.tsx**: 名称输入 + 颜色选择，创建/编辑复用
- **tag-list.tsx**: 卡片网格，显示颜色预览、名称、关联任务数

- [ ] **Step 2: 创建标签管理页面**

- [ ] **Step 3: 验证标签 CRUD**

创建/编辑/删除标签，确认操作成功。

- [ ] **Step 4: 提交**

```bash
git add frontend/apps/web/components/tags/ frontend/apps/web/app/(dashboard)/tags/
git commit -m "feat: 新增标签管理页面"
```

---

## Task 15: 前端 — 回收站页

**Files:**
- Create: `frontend/apps/web/components/trash/trash-list.tsx`
- Create: `frontend/apps/web/app/(dashboard)/trash/page.tsx`

- [ ] **Step 1: 创建回收站列表组件和页面**

表格布局，显示标题、原状态、删除时间、操作按钮（恢复/永久删除）。永久删除需二次确认。

- [ ] **Step 2: 验证回收站功能**

删除一个任务 → 回收站出现 → 恢复 → 回到看板。永久删除 → 彻底消失。

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/components/trash/ frontend/apps/web/app/(dashboard)/trash/
git commit -m "feat: 新增回收站页面"
```

---

## Task 16: 集成测试 + 最终验证

- [ ] **Step 1: 运行后端全部测试**

```bash
docker compose exec api uv run -- pytest . -v
```

Expected: 全部 PASS。

- [ ] **Step 2: 重启前端容器使所有变更生效**

```bash
docker compose restart web
```

- [ ] **Step 3: 功能验证清单**

在浏览器中逐一验证：

- [ ] 看板三列显示：待办 / 进行中 / 已完成
- [ ] 创建任务（标题、描述、优先级、截止日期、标签）
- [ ] 拖拽任务卡片可改变状态
- [ ] 泳道切换：无 / 按标签 / 按优先级
- [ ] 编辑任务可修改所有字段
- [ ] 删除任务后出现在回收站
- [ ] 回收站可恢复任务
- [ ] 回收站可永久删除（需确认）
- [ ] 标签创建/编辑/删除
- [ ] 标签仅对创建者可见
- [ ] 普通用户只看到自己的任务
- [ ] 中英文切换正常

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: 第二期任务看板完成"
```

---

## 自检清单

| 检查项 | 状态 |
|--------|------|
| 无 TBD/TODO 占位符 | ⚠️ Task 9-15 的组件代码需要根据 OpenAPI 生成的方法名填写，在 Task 4 完成后更新 |
| 需求文档验收标准全覆盖 | ✅ 5.1 看板(6项)、5.2 标签(3项)、5.3 回收站(4项) |
| 类型一致性 | ✅ 后端模型字段 → Serializer → API 响应 → 前端类型链路一致 |
| 权限与第一期一致 | ✅ IsOwnerOrAdmin 复用 |
| i18n 全覆盖 | ✅ 所有新页面都有翻译键 |

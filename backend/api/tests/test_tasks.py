from datetime import timedelta

import pytest
from django.utils import timezone

from api.models import Tag, Task


@pytest.mark.django_db
def test_task_create(api_client, regular_user):
    """测试创建任务"""
    api_client.force_authenticate(regular_user)
    response = api_client.post(
        "/api/tasks/",
        {"title": "测试任务", "priority": "high"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["title"] == "测试任务"
    assert response.data["status"] == "todo"
    assert response.data["priority"] == "high"


@pytest.mark.django_db
def test_task_create_with_tags(api_client, regular_user):
    """测试创建任务带标签"""
    tag = Tag.objects.create(name="bug", color="#EF4444", created_by=regular_user)
    api_client.force_authenticate(regular_user)
    response = api_client.post(
        "/api/tasks/",
        {"title": "修复 bug", "priority": "high", "tags": [str(tag.id)]},
        format="json",
    )
    assert response.status_code == 201
    assert len(response.data["tags"]) == 1
    assert response.data["tags"][0]["name"] == "bug"


@pytest.mark.django_db
def test_task_list_only_mine(api_client, regular_user, admin_user):
    """测试普通用户只看到自己的任务"""
    Task.objects.create(title="我的任务", created_by=regular_user)
    Task.objects.create(title="管理员任务", created_by=admin_user)

    api_client.force_authenticate(regular_user)
    response = api_client.get("/api/tasks/")
    assert response.status_code == 200
    titles = [t["title"] for t in response.data["results"]]
    assert "我的任务" in titles
    assert "管理员任务" not in titles


@pytest.mark.django_db
def test_task_admin_sees_own_only(api_client, admin_user, regular_user):
    """测试管理员在 web 端只能看到自己的任务（管理端通过 /api/admin/ 查看）"""
    Task.objects.create(title="用户任务", created_by=regular_user)
    Task.objects.create(title="管理员任务", created_by=admin_user)

    api_client.force_authenticate(admin_user)
    response = api_client.get("/api/tasks/")
    assert response.status_code == 200
    titles = [t["title"] for t in response.data["results"]]
    assert "管理员任务" in titles
    assert "用户任务" not in titles


@pytest.mark.django_db
def test_task_soft_delete(api_client, regular_user):
    """测试软删除"""
    task = Task.objects.create(title="要删除的任务", created_by=regular_user)
    api_client.force_authenticate(regular_user)
    response = api_client.delete(f"/api/tasks/{task.id}/")
    assert response.status_code == 204

    # 任务仍然存在但标记为已删除
    task.refresh_from_db()
    assert task.is_deleted is True
    assert task.deleted_at is not None

    # 不再出现在正常列表中
    response = api_client.get("/api/tasks/")
    titles = [t["title"] for t in response.data["results"]]
    assert "要删除的任务" not in titles


@pytest.mark.django_db
def test_task_restore(api_client, regular_user):
    """测试从回收站恢复"""
    task = Task.objects.create(
        title="恢复的任务", created_by=regular_user, is_deleted=True,
        deleted_at=timezone.now()
    )
    api_client.force_authenticate(regular_user)
    response = api_client.post(f"/api/tasks/{task.id}/restore/")
    assert response.status_code == 200

    task.refresh_from_db()
    assert task.is_deleted is False
    assert task.deleted_at is None


@pytest.mark.django_db
def test_task_trash_list(api_client, regular_user):
    """测试回收站列表"""
    Task.objects.create(title="正常任务", created_by=regular_user)
    Task.objects.create(
        title="已删除任务", created_by=regular_user, is_deleted=True,
        deleted_at=timezone.now()
    )
    api_client.force_authenticate(regular_user)
    response = api_client.get("/api/tasks/trash/")
    assert response.status_code == 200
    titles = [t["title"] for t in response.data["results"]]
    assert "已删除任务" in titles
    assert "正常任务" not in titles


@pytest.mark.django_db
def test_task_permanent_delete(api_client, regular_user):
    """测试永久删除"""
    task = Task.objects.create(
        title="永久删除", created_by=regular_user, is_deleted=True,
        deleted_at=timezone.now()
    )
    api_client.force_authenticate(regular_user)
    response = api_client.delete(f"/api/tasks/{task.id}/permanent/")
    assert response.status_code == 204
    assert not Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
def test_task_patch_status(api_client, regular_user):
    """测试拖拽更新状态"""
    task = Task.objects.create(title="拖拽任务", created_by=regular_user)
    api_client.force_authenticate(regular_user)
    response = api_client.patch(
        f"/api/tasks/{task.id}/",
        {"status": "in_progress"},
        format="json",
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

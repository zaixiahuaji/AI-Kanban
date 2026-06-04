import pytest
from django.utils.text import slugify
from rest_framework.test import APIClient

from api.models import BoardColumn, Tag, Task


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def regular_user(db, django_user_model):
    user = django_user_model.objects.create_user(
        username="testuser", password="testpass123", email="testuser@example.com"
    )
    return user


@pytest.fixture
def user_factory(db, django_user_model):
    def create(username):
        return django_user_model.objects.create_user(
            username=username, password="testpass123",
            email=f"{username}@example.com"
        )

    return create


def _create_column(user, name, slug=None, position=0):
    return BoardColumn.objects.create(
        name=name,
        slug=slug or slugify(name),
        position=position,
        created_by=user,
    )


def _create_task(user, title, status="todo", priority="medium", tags=None):
    task = Task.objects.create(
        title=title,
        status=status,
        priority=priority,
        created_by=user,
    )
    if tags:
        task.tags.set(tags)
    return task


@pytest.mark.django_db
def test_statistics_empty(api_client, regular_user):
    """无任务时返回 total=0 和空列表"""
    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200
    assert resp.data["total"] == 0
    assert resp.data["by_status"] == []
    assert resp.data["by_priority"] == []
    assert resp.data["by_tag"] == []


@pytest.mark.django_db
def test_statistics_by_status(api_client, regular_user):
    """按状态正确分组计数"""
    # 信号已自动创建 todo(待办)、in_progress(进行中)、done(已完成) 三列
    _create_task(regular_user, "T1", status="todo")
    _create_task(regular_user, "T2", status="todo")
    _create_task(regular_user, "T3", status="done")

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200
    assert resp.data["total"] == 3

    status_map = {item["status"]: item for item in resp.data["by_status"]}
    assert status_map["todo"]["count"] == 2
    assert status_map["todo"]["label"] == "待办"
    assert status_map["done"]["count"] == 1
    assert status_map["done"]["label"] == "已完成"


@pytest.mark.django_db
def test_statistics_by_priority(api_client, regular_user):
    """按优先级正确分组计数"""
    _create_task(regular_user, "T1", priority="high")
    _create_task(regular_user, "T2", priority="high")
    _create_task(regular_user, "T3", priority="low")

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200

    priority_map = {item["priority"]: item for item in resp.data["by_priority"]}
    assert priority_map["high"]["count"] == 2
    assert priority_map["low"]["count"] == 1


@pytest.mark.django_db
def test_statistics_by_tag(api_client, regular_user):
    """按标签正确分组计数"""
    tag1 = Tag.objects.create(name="工作", color="#6366f1", created_by=regular_user)
    tag2 = Tag.objects.create(name="学习", color="#f59e0b", created_by=regular_user)
    _create_task(regular_user, "T1", tags=[tag1])
    _create_task(regular_user, "T2", tags=[tag1])
    _create_task(regular_user, "T3", tags=[tag2])
    _create_task(regular_user, "T4")  # 无标签

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200

    tag_map = {item["name"]: item for item in resp.data["by_tag"]}
    assert tag_map["工作"]["count"] == 2
    assert tag_map["工作"]["color"] == "#6366f1"
    assert tag_map["学习"]["count"] == 1
    # 无标签的任务不计入 by_tag


@pytest.mark.django_db
def test_statistics_excludes_deleted(api_client, regular_user):
    """已软删除的任务不计入统计"""
    _create_task(regular_user, "T1", status="todo")
    task = _create_task(regular_user, "T2", status="done")
    task.is_deleted = True
    task.save()

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200
    assert resp.data["total"] == 1
    assert len(resp.data["by_status"]) == 1
    assert resp.data["by_status"][0]["status"] == "todo"


@pytest.mark.django_db
def test_statistics_user_isolation(api_client, regular_user, user_factory):
    """不同用户数据完全隔离"""
    # other 用户创建时信号也会自动创建默认列，无需手动创建
    other = user_factory("other")
    _create_task(other, "Other Task", status="todo")

    _create_task(regular_user, "My Task", status="todo")

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200
    assert resp.data["total"] == 1
    # status label 来自 regular_user 自己的 BoardColumn
    status_map = {item["status"]: item for item in resp.data["by_status"]}
    assert status_map["todo"]["label"] == "待办"  # 信号创建的默认列


@pytest.mark.django_db
def test_statistics_unauthenticated(api_client):
    """未认证请求返回 401"""
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 401

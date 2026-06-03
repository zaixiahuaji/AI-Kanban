import pytest

from api.models import BoardColumn, Task


@pytest.mark.django_db
def test_list_columns(api_client, regular_user):
    """测试列出用户的列，验证按 position 排序"""
    # regular_user 创建时信号会自动创建 3 个默认列
    api_client.force_authenticate(regular_user)
    response = api_client.get("/api/columns/")
    assert response.status_code == 200
    results = response.data["results"]
    assert len(results) == 3
    # 验证按 position 排序
    positions = [col["position"] for col in results]
    assert positions == sorted(positions)


@pytest.mark.django_db
def test_create_column(api_client, regular_user):
    """测试创建列：slug 自动生成、position 自动递增"""
    api_client.force_authenticate(regular_user)
    # 默认已有 3 列（position 0,1,2），新建一个
    response = api_client.post(
        "/api/columns/",
        {"name": "Review"},
        format="json",
    )
    assert response.status_code == 201
    data = response.data
    assert data["name"] == "Review"
    assert data["slug"] == "review"
    assert data["position"] == 3  # 最高 position(2) + 1


@pytest.mark.django_db
def test_create_column_slug_dedup(api_client, regular_user):
    """测试创建同名列时 slug 自动去重"""
    api_client.force_authenticate(regular_user)
    # 默认已有 todo 列，再创建一个叫 "todo" 的
    response1 = api_client.post(
        "/api/columns/",
        {"name": "todo"},
        format="json",
    )
    assert response1.status_code == 201
    assert response1.data["slug"] == "todo-1"

    # 再创建一个
    response2 = api_client.post(
        "/api/columns/",
        {"name": "todo"},
        format="json",
    )
    assert response2.status_code == 201
    assert response2.data["slug"] == "todo-2"


@pytest.mark.django_db
def test_rename_column(api_client, regular_user):
    """测试重命名列只改 name，不改 slug"""
    api_client.force_authenticate(regular_user)
    # 获取默认的 "待办" 列
    columns = api_client.get("/api/columns/").data["results"]
    todo_col = next(c for c in columns if c["slug"] == "todo")

    response = api_client.patch(
        f"/api/columns/{todo_col['id']}/",
        {"name": "To Do"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["name"] == "To Do"
    # slug 不变
    assert response.data["slug"] == "todo"


@pytest.mark.django_db
def test_delete_empty_column(api_client, regular_user):
    """测试删除空列返回 204"""
    api_client.force_authenticate(regular_user)
    # 新建一个空列
    col = BoardColumn.objects.create(
        name="临时列", slug="temp", position=99, created_by=regular_user
    )
    response = api_client.delete(f"/api/columns/{col.id}/")
    assert response.status_code == 204
    assert not BoardColumn.objects.filter(id=col.id).exists()


@pytest.mark.django_db
def test_delete_column_with_tasks(api_client, regular_user):
    """测试删除有任务的列返回 400"""
    api_client.force_authenticate(regular_user)
    # 在 todo 列下创建一个任务
    Task.objects.create(title="测试任务", status="todo", created_by=regular_user)

    columns = api_client.get("/api/columns/").data["results"]
    todo_col = next(c for c in columns if c["slug"] == "todo")

    response = api_client.delete(f"/api/columns/{todo_col['id']}/")
    assert response.status_code == 400
    assert "tasks" in response.data["detail"].lower()


@pytest.mark.django_db
def test_reorder_columns(api_client, regular_user):
    """测试批量重排列，验证 position 更新"""
    api_client.force_authenticate(regular_user)
    columns = api_client.get("/api/columns/").data["results"]
    assert len(columns) == 3

    # 反转顺序
    items = [
        {"id": columns[2]["id"], "position": 0},
        {"id": columns[1]["id"], "position": 1},
        {"id": columns[0]["id"], "position": 2},
    ]
    response = api_client.post(
        "/api/columns/reorder/",
        {"items": items},
        format="json",
    )
    assert response.status_code == 200

    # 验证 position 已更新
    updated = api_client.get("/api/columns/").data["results"]
    id_to_pos = {col["id"]: col["position"] for col in updated}
    assert id_to_pos[columns[2]["id"]] == 0
    assert id_to_pos[columns[1]["id"]] == 1
    assert id_to_pos[columns[0]["id"]] == 2


@pytest.mark.django_db
def test_columns_isolation(api_client, regular_user, user_factory):
    """测试用户看不到其他用户的列"""
    # regular_user 已有 3 个默认列
    other_user = user_factory.create(is_active=True)
    # other_user 通过信号也有 3 个默认列

    api_client.force_authenticate(regular_user)
    response = api_client.get("/api/columns/")
    assert response.status_code == 200

    # 验证只看到自己的 3 列
    results = response.data["results"]
    assert len(results) == 3
    col_ids = {col["id"] for col in results}
    # 所有列都属于 regular_user
    for col_id in col_ids:
        col = BoardColumn.objects.get(id=col_id)
        assert col.created_by == regular_user


@pytest.mark.django_db
def test_new_user_gets_default_columns(user_factory):
    """测试新用户通过信号自动获得 3 个默认列"""
    new_user = user_factory.create(is_active=True)
    columns = BoardColumn.objects.filter(created_by=new_user)
    assert columns.count() == 3

    slugs = set(columns.values_list("slug", flat=True))
    assert slugs == {"todo", "in_progress", "done"}

    names = dict(columns.values_list("slug", "name"))
    assert names["todo"] == "待办"
    assert names["in_progress"] == "进行中"
    assert names["done"] == "已完成"

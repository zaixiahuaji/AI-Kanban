import pytest
from api.models import Tag


@pytest.mark.django_db
def test_tag_create(api_client, regular_user):
    """测试创建标签"""
    api_client.force_authenticate(regular_user)
    response = api_client.post(
        "/api/tags/",
        {"name": "bug", "color": "#EF4444"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "bug"
    assert response.data["color"] == "#EF4444"


@pytest.mark.django_db
def test_tag_list_only_mine(api_client, regular_user, admin_user):
    """测试只能看到自己的标签"""
    Tag.objects.create(name="user_tag", color="#000", created_by=regular_user)
    Tag.objects.create(name="admin_tag", color="#000", created_by=admin_user)

    api_client.force_authenticate(regular_user)
    response = api_client.get("/api/tags/")
    assert response.status_code == 200
    names = [t["name"] for t in response.data["results"]]
    assert "user_tag" in names
    assert "admin_tag" not in names


@pytest.mark.django_db
def test_tag_duplicate_name(api_client, regular_user):
    """测试同一用户不能创建重复名称标签"""
    Tag.objects.create(name="bug", color="#EF4444", created_by=regular_user)
    api_client.force_authenticate(regular_user)
    response = api_client.post(
        "/api/tags/",
        {"name": "bug", "color": "#22C55E"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_tag_delete(api_client, regular_user):
    """测试删除标签"""
    tag = Tag.objects.create(name="bug", color="#EF4444", created_by=regular_user)
    api_client.force_authenticate(regular_user)
    response = api_client.delete(f"/api/tags/{tag.id}/")
    assert response.status_code == 204
    assert not Tag.objects.filter(id=tag.id).exists()

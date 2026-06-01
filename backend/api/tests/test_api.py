import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
def test_api_users_me_unauthorized(client):
    response = client.get(reverse("api-users-me"))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_api_users_me_authorized(api_client, regular_user):
    api_client.force_authenticate(user=regular_user)
    response = api_client.get(reverse("api-users-me"))
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_api_send_code_success(client):
    """测试发送验证码成功"""
    from api.models import EmailVerification

    response = client.post(
        "/api/email/send-code/",
        {"email": "test@example.com"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert EmailVerification.objects.filter(email="test@example.com").count() == 1


@pytest.mark.django_db
def test_api_send_code_rate_limit(client):
    """测试 60 秒内不能重复发送"""
    client.post(
        "/api/email/send-code/",
        {"email": "test@example.com"},
        content_type="application/json",
    )
    response = client.post(
        "/api/email/send-code/",
        {"email": "test@example.com"},
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_api_send_code_invalid_email(client):
    """测试无效邮箱"""
    response = client.post(
        "/api/email/send-code/",
        {"email": "invalid"},
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_api_register_with_code(client):
    """测试带验证码注册成功"""
    from datetime import timedelta

    from django.utils import timezone

    from api.models import EmailVerification

    email = "newuser@example.com"
    code = "123456"
    EmailVerification.objects.create(
        email=email, code=code, created_at=timezone.now()
    )

    response = client.post(
        "/api/users/",
        {
            "username": "newuser",
            "email": email,
            "code": code,
            "password": "securepass123",
            "password_retype": "securepass123",
        },
        content_type="application/json",
    )
    assert response.status_code == 201

    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.get(username="newuser")
    assert user.is_active is True

    verification = EmailVerification.objects.get(email=email, code=code)
    assert verification.is_used is True


@pytest.mark.django_db
def test_api_register_wrong_code(client):
    """测试错误验证码"""
    from django.utils import timezone

    from api.models import EmailVerification

    EmailVerification.objects.create(
        email="newuser@example.com", code="123456", created_at=timezone.now()
    )

    response = client.post(
        "/api/users/",
        {
            "username": "newuser",
            "email": "newuser@example.com",
            "code": "000000",
            "password": "securepass123",
            "password_retype": "securepass123",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_api_register_duplicate_email(client):
    """测试重复邮箱注册"""
    from django.utils import timezone

    from django.contrib.auth import get_user_model

    from api.models import EmailVerification

    User = get_user_model()
    User.objects.create_user(
        username="existing", email="taken@example.com", password="pass12345678"
    )

    EmailVerification.objects.create(
        email="taken@example.com", code="123456", created_at=timezone.now()
    )

    response = client.post(
        "/api/users/",
        {
            "username": "newuser",
            "email": "taken@example.com",
            "code": "123456",
            "password": "securepass123",
            "password_retype": "securepass123",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_api_is_owner_or_admin_permission(api_client, regular_user, admin_user):
    """测试 IsOwnerOrAdmin 权限类"""
    from unittest.mock import Mock

    from api.permissions import IsOwnerOrAdmin

    perm = IsOwnerOrAdmin()

    obj = Mock()
    obj.user = regular_user

    # Regular user can access their own data
    request = Mock()
    request.user = regular_user
    assert perm.has_object_permission(request, None, obj) is True

    # Regular user cannot access others' data
    other_user = Mock()
    other_user.pk = 999
    other_user.is_staff = False
    request.user = other_user
    assert perm.has_object_permission(request, None, obj) is False

    # Admin can access all data
    admin_request = Mock()
    admin_request.user = admin_user
    assert perm.has_object_permission(admin_request, None, obj) is True

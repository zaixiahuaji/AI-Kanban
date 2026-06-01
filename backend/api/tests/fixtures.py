import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def regular_user(user_factory):
    return user_factory.create(is_active=True)


@pytest.fixture
def admin_user(user_factory):
    return user_factory.create(is_active=True, is_staff=True)

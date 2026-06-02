from django.contrib.auth import get_user_model
from factory import Sequence
from factory import SubFactory
from factory.django import DjangoModelFactory

from api.models import Tag


class UserFactory(DjangoModelFactory):
    username = Sequence(lambda n: f"user_{n}")
    email = Sequence(lambda n: f"user_{n}@example.com")
    password = "testpass12345678"

    class Meta:
        model = get_user_model()


class TagFactory(DjangoModelFactory):
    name = Sequence(lambda n: f"tag_{n}")
    color = "#3B82F6"
    created_by = SubFactory(UserFactory)

    class Meta:
        model = Tag

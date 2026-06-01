from django.contrib.auth import get_user_model
from factory import Sequence
from factory.django import DjangoModelFactory


class UserFactory(DjangoModelFactory):
    username = Sequence(lambda n: f"user_{n}")
    email = Sequence(lambda n: f"user_{n}@example.com")
    password = "testpass12345678"

    class Meta:
        model = get_user_model()

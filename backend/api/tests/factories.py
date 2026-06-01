from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory


class UserFactory(DjangoModelFactory):
    username = "testuser"
    email = "testuser@example.com"
    password = "testpass12345678"

    class Meta:
        model = get_user_model()

    class Params:
        is_active = True

from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm
from django.utils.translation import gettext_lazy as _

from .models import User


class CustomUserCreationForm(BaseUserCreationForm):
    """在创建用户表单中加入邮箱字段"""

    class Meta:
        model = User
        fields = ("username", "email")

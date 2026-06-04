from unfold.forms import UserCreationForm

from .models import User


class CustomUserCreationForm(UserCreationForm):
    """在创建用户表单中加入邮箱字段"""

    class Meta:
        model = User
        fields = ("username", "email")

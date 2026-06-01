# 第一期实施计划 — 基础能力建设

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成国际化、邮箱验证码注册、RBAC 角色权限三个基础模块，为后续任务看板核心业务打基础。

**Architecture:** 在现有 Django + Next.js + Turborepo 架构上做增量开发。后端新增 EmailVerification 模型和验证码 API，改造注册流程；前端引入 next-intl 做国际化，改造注册表单增加邮箱和验证码；RBAC 基于 Django 内置 is_staff 字段实现两级权限。

**Tech Stack:** Django 5.1 / DRF / simplejwt / next-intl / react-hook-form / zod / Tailwind CSS / PostgreSQL

**Spec:** [第一期-需求文档.md](../../第一期-需求文档.md) / [第一期-技术设计文档.md](../../第一期-技术设计文档.md)

---

## 文件结构总览

### 后端新建文件

| 文件 | 职责 |
|------|------|
| `backend/api/permissions.py` | IsOwnerOrAdmin 自定义权限类 |
| `backend/api/migrations/0002_*.py` | 数据库迁移（email 唯一约束 + EmailVerification 表） |

### 后端修改文件

| 文件 | 改动 |
|------|------|
| `backend/api/models.py` | User.email 改为必填唯一；新增 EmailVerification 模型 |
| `backend/api/serializers.py` | UserCreateSerializer 新增 email/code 字段；修复 validate_password 异常类型 bug |
| `backend/api/api.py` | 新增 SendCodeView |
| `backend/api/urls.py` | 注册 send-code 路由 |
| `backend/api/settings.py` | 新增 LocaleMiddleware、LANGUAGES、LOCALE_PATHS、邮件 SMTP 配置 |
| `backend/api/tests/test_api.py` | 新增验证码发送和注册相关测试 |
| `.env.backend` | 新增邮件 SMTP 环境变量 |

### 前端新建文件

| 文件 | 职责 |
|------|------|
| `frontend/packages/ui/locales/en.json` | 英文翻译文件 |
| `frontend/packages/ui/locales/zh-CN.json` | 中文翻译文件 |
| `frontend/apps/web/i18n/routing.ts` | next-intl 路由配置 |
| `frontend/apps/web/i18n/request.ts` | next-intl 请求配置 |
| `frontend/apps/web/middleware.ts` | 语言检测中间件 |
| `frontend/apps/web/actions/send-code-action.ts` | 发送验证码 Server Action |
| `frontend/apps/web/components/language-switcher.tsx` | 语言切换组件 |

### 前端修改文件

| 文件 | 改动 |
|------|------|
| `frontend/apps/web/next.config.ts` | 集成 next-intl 插件 |
| `frontend/apps/web/app/layout.tsx` | 集成 NextIntlClientProvider + 语言切换 |
| `frontend/apps/web/lib/validation.ts` | registerFormSchema 新增 email/code，密码 min 改为 8 |
| `frontend/apps/web/lib/auth.ts` | session 扩展 isStaff 字段 |
| `frontend/apps/web/components/forms/register-form.tsx` | 新增邮箱、验证码字段和发送按钮 |
| `frontend/apps/web/actions/register-action.ts` | 注册请求增加 email 和 code 参数 |

---

## Task 1: 修复已有 Bug（前置条件）

**Files:**
- Modify: `backend/api/serializers.py:99`
- Modify: `frontend/apps/web/lib/validation.ts`

- [ ] **Step 1: 修复后端 validate_password 异常类型**

`backend/api/serializers.py` 第 99 行，`UserCreateSerializer.validate()` 中 `validate_password()` 抛出的是 `django.core.exceptions.ValidationError`，但 except 捕获的是 `rest_framework.exceptions.ValidationError`，导致 except 块永远不会触发。

将：
```python
        try:
            validate_password(attrs.get("password"))
        except exceptions.ValidationError:
            self.fail("password_invalid")
```

改为：
```python
        try:
            validate_password(attrs.get("password"))
        except ValidationError:
            self.fail("password_invalid")
```

注意：文件顶部已有 `from django.core.exceptions import ValidationError` 的导入。

- [ ] **Step 2: 修复前端密码最小长度**

`frontend/apps/web/lib/validation.ts`，registerFormSchema 中密码 min(6) 改为 min(8)，与后端 Django MinimumLengthValidator 一致。

将：
```ts
const registerFormSchema = z
  .object({
    username: z.string().min(6),
    password: z.string().min(6),
    passwordRetype: z.string().min(6)
  })
```

改为：
```ts
const registerFormSchema = z
  .object({
    username: z.string().min(6),
    password: z.string().min(8),
    passwordRetype: z.string().min(8)
  })
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/serializers.py frontend/apps/web/lib/validation.ts
git commit -m "fix: 修复 validate_password 异常类型和密码最小长度不一致"
```

---

## Task 2: 后端 — Django i18n 配置

**Files:**
- Modify: `backend/api/settings.py`

- [ ] **Step 1: 修改 settings.py 的 i18n 配置**

在 `backend/api/settings.py` 中做以下改动：

1. `MIDDLEWARE` 列表中，在 `SessionMiddleware` 之后新增 `LocaleMiddleware`：
```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    # ... 其余不变
]
```

2. 修改 `LANGUAGE_CODE` 和新增 `LANGUAGES`、`LOCALE_PATHS`：
```python
LANGUAGE_CODE = "en"

LANGUAGES = [
    ("en", "English"),
    ("zh-cn", "简体中文"),
]

LOCALE_PATHS = [
    BASE_DIR / "locale",
]
```

- [ ] **Step 2: 提交**

```bash
git add backend/api/settings.py
git commit -m "feat: 配置 Django i18n 支持中英文"
```

---

## Task 3: 后端 — 邮件 SMTP 配置

**Files:**
- Modify: `backend/api/settings.py`
- Modify: `.env.backend`

- [ ] **Step 1: 在 settings.py 底部新增邮件配置**

在 `backend/api/settings.py` 底部新增：
```python
######################################################################
# Email
######################################################################
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = environ.get("EMAIL_HOST", "smtp.163.com")
EMAIL_PORT = int(environ.get("EMAIL_PORT", "465"))
EMAIL_USE_SSL = environ.get("EMAIL_USE_SSL", "True") == "True"
EMAIL_HOST_USER = environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)
```

- [ ] **Step 2: 在 .env.backend 新增邮件环境变量**

在 `.env.backend` 文件末尾追加（值留空，用户自行填写）：
```
EMAIL_HOST=smtp.163.com
EMAIL_PORT=465
EMAIL_USE_SSL=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/settings.py .env.backend
git commit -m "feat: 配置邮件 SMTP 发送"
```

---

## Task 4: 后端 — EmailVerification 模型 + User 模型改造

**Files:**
- Modify: `backend/api/models.py`

- [ ] **Step 1: 修改 User 模型的 email 字段并新增 EmailVerification 模型**

在 `backend/api/models.py` 中：

1. 在文件顶部新增 `import uuid`
2. 修改 User 模型，将 email 改为必填唯一：
```python
class User(AbstractUser):
    email = models.EmailField(
        _("email"),
        unique=True,
        error_messages={
            "unique": _("A user with that email already exists."),
        },
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    class Meta:
        db_table = "users"
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self):
        return self.email if self.email else self.username
```

3. 在 User 模型下方新增 EmailVerification 模型：
```python
class EmailVerification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_("email"))
    code = models.CharField(_("verification code"), max_length=6)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    is_used = models.BooleanField(_("used"), default=False)

    class Meta:
        db_table = "email_verification"
        ordering = ["-created_at"]
        verbose_name = _("email verification")
        verbose_name_plural = _("email verifications")
        indexes = [
            models.Index(fields=["email", "-created_at"], name="idx_email_created"),
        ]

    def __str__(self):
        return f"{self.email} - {self.code}"
```

- [ ] **Step 2: 生成并执行迁移**

```bash
docker compose exec api uv run -- python manage.py makemigrations api
docker compose exec api uv run -- python manage.py migrate
```

Expected: 生成 `0002_*.py` 迁移文件，迁移成功无报错。

- [ ] **Step 3: 提交**

```bash
git add backend/api/models.py backend/api/migrations/
git commit -m "feat: 新增 EmailVerification 模型，User.email 改为必填唯一"
```

---

## Task 5: 后端 — 发送验证码 API + Serializer

**Files:**
- Modify: `backend/api/serializers.py`
- Create: `backend/api/api.py` 中新增 SendCodeView
- Modify: `backend/api/urls.py`

- [ ] **Step 1: 在 serializers.py 新增 SendCodeSerializer**

在 `backend/api/serializers.py` 文件顶部新增：
```python
from datetime import timedelta

from django.utils import timezone
```

在文件末尾新增：
```python
class SendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()

    default_error_messages = {
        "rate_limit": _("Please wait before requesting another code."),
        "daily_limit": _("Too many verification codes sent today."),
    }

    def validate_email(self, value):
        # 检查 60 秒内是否已发送
        recent = EmailVerification.objects.filter(
            email=value,
            created_at__gte=timezone.now() - timedelta(seconds=60),
        ).exists()
        if recent:
            self.fail("rate_limit")

        # 检查 24 小时内发送次数
        daily_count = EmailVerification.objects.filter(
            email=value,
            created_at__gte=timezone.now() - timedelta(hours=24),
        ).count()
        if daily_count >= 10:
            self.fail("daily_limit")

        return value
```

注意：在文件顶部 model import 之后新增：
```python
from .models import EmailVerification
```

（将现有的 `User = get_user_model()` 保留，在下方新增 EmailVerification 导入）

- [ ] **Step 2: 在 api.py 新增 SendCodeView**

在 `backend/api/api.py` 中：

1. 新增导入：
```python
import random

from django.core.mail import send_mail
from django.utils.translation import gettext_lazy as _

from .models import EmailVerification
from .serializers import SendCodeSerializer
```

2. 在 UserViewSet 之前新增 SendCodeView：
```python
class SendCodeView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=SendCodeSerializer,
        responses={200: None, 400: None},
    )
    def post(self, request):
        serializer = SendCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = str(random.randint(100000, 999999))

        EmailVerification.objects.create(email=email, code=code)

        send_mail(
            subject=_("Turbo - Verification Code"),
            message=_(
                "Your verification code is: %(code)s. "
                "It will expire in 5 minutes. "
                "If you did not request this, please ignore this email."
            )
            % {"code": code},
            from_email=None,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response({"message": _("Verification code sent.")})
```

3. 确保导入 `APIView` 和 `extend_schema`：
```python
from rest_framework.views import APIView
```

- [ ] **Step 3: 在 urls.py 注册路由**

在 `backend/api/urls.py` 中新增导入：
```python
from .api import SendCodeView
```

在 `urlpatterns` 列表中，在 `path("api/", include(router.urls))` 之前新增：
```python
path("api/email/send-code/", SendCodeView.as_view(), name="send-code"),
```

- [ ] **Step 4: 提交**

```bash
git add backend/api/serializers.py backend/api/api.py backend/api/urls.py
git commit -m "feat: 新增发送验证码 API 接口"
```

---

## Task 6: 后端 — 改造注册接口（增加邮箱 + 验证码）

**Files:**
- Modify: `backend/api/serializers.py`
- Modify: `backend/api/api.py`

- [ ] **Step 1: 改造 UserCreateSerializer**

在 `backend/api/serializers.py` 中修改 `UserCreateSerializer`：

1. 新增导入（如果还没有）：
```python
from datetime import timedelta

from django.utils import timezone
from .models import EmailVerification
```

2. 改造后的 UserCreateSerializer：
```python
class UserCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    code = serializers.CharField(write_only=True)
    password = serializers.CharField(style={"input_type": "password"}, write_only=True)
    password_retype = serializers.CharField(
        style={"input_type": "password"}, write_only=True
    )

    default_error_messages = {
        "password_mismatch": _("Passwords are not matching."),
        "password_invalid": _("Password does not meet all requirements."),
        "code_invalid": _("Verification code is invalid or expired."),
    }

    class Meta:
        model = User
        fields = ["username", "email", "code", "password", "password_retype"]

    def validate(self, attrs):
        code = attrs.pop("code")
        password_retype = attrs.pop("password_retype")

        # 校验密码
        try:
            validate_password(attrs.get("password"))
        except ValidationError as e:
            raise exceptions.ValidationError({"password": list(e.messages)}) from e

        if attrs["password"] != password_retype:
            self.fail("password_mismatch")

        # 校验验证码
        verification = EmailVerification.objects.filter(
            email=attrs["email"],
            code=code,
            is_used=False,
            created_at__gte=timezone.now() - timedelta(minutes=5),
        ).first()

        if verification is None:
            self.fail("code_invalid")

        attrs["verification"] = verification
        return attrs

    def create(self, validated_data):
        verification = validated_data.pop("verification")
        with transaction.atomic():
            user = User.objects.create_user(**validated_data)
            user.is_active = True
            user.save(update_fields=["is_active"])
            verification.is_used = True
            verification.save(update_fields=["is_used"])
        return user
```

- [ ] **Step 2: 更新 api.py 中 create 方法的 schema 注解**

在 `backend/api/api.py` 的 `UserViewSet.create()` 方法中，确保 `@extend_schema` 的 request 也更新：
```python
    @extend_schema(
        request=UserCreateSerializer,
        responses={
            201: UserCreateSerializer,
            400: UserCreateErrorSerializer,
        }
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/serializers.py backend/api/api.py
git commit -m "feat: 注册接口增加邮箱和验证码，注册后直接激活"
```

---

## Task 7: 后端 — IsOwnerOrAdmin 权限类

**Files:**
- Create: `backend/api/permissions.py`

- [ ] **Step 1: 创建权限类文件**

新建 `backend/api/permissions.py`：
```python
from rest_framework.permissions import BasePermission


class IsOwnerOrAdmin(BasePermission):
    """
    普通用户只能操作自己的数据，
    管理员可以操作所有数据。
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        return getattr(obj, "user", None) == request.user
```

- [ ] **Step 2: 提交**

```bash
git add backend/api/permissions.py
git commit -m "feat: 新增 IsOwnerOrAdmin 自定义权限类"
```

---

## Task 8: 后端 — 测试

**Files:**
- Modify: `backend/api/tests/test_api.py`
- Modify: `backend/api/tests/factories.py`
- Modify: `backend/api/tests/fixtures.py`

- [ ] **Step 1: 更新 UserFactory 和 fixtures**

`backend/api/tests/factories.py`，确保 UserFactory 包含 email 和 password：
```python
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
```

`backend/api/tests/fixtures.py`，更新 regular_user fixture：
```python
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
```

- [ ] **Step 2: 新增验证码和注册测试**

在 `backend/api/tests/test_api.py` 末尾新增测试：
```python
from api.models import EmailVerification


@pytest.mark.django_db
def test_api_send_code_success(client):
    """测试发送验证码成功"""
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
    from django.utils import timezone
    from datetime import timedelta

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

    # 验证用户已激活
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(username="newuser")
    assert user.is_active is True

    # 验证验证码已标记为已使用
    verification = EmailVerification.objects.get(email=email, code=code)
    assert verification.is_used is True


@pytest.mark.django_db
def test_api_register_wrong_code(client):
    """测试错误验证码"""
    from django.utils import timezone

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

    # 创建已有用户
    from django.contrib.auth import get_user_model
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
    from rest_framework.test import APIRequestFactory
    from api.permissions import IsOwnerOrAdmin
    from unittest.mock import Mock

    perm = IsOwnerOrAdmin()

    # 创建一个 mock 对象模拟有 user 属性的数据
    obj = Mock()
    obj.user = regular_user

    # 普通用户只能操作自己的数据
    request = Mock()
    request.user = regular_user
    assert perm.has_object_permission(request, None, obj) is True

    # 普通用户不能操作别人的数据
    other_user = Mock()
    other_user.pk = 999
    other_user.is_staff = False
    request.user = other_user
    assert perm.has_object_permission(request, None, obj) is False

    # 管理员可以操作所有数据
    admin_request = Mock()
    admin_request.user = admin_user
    assert perm.has_object_permission(admin_request, None, obj) is True
```

- [ ] **Step 3: 运行全部测试**

```bash
docker compose exec api uv run -- pytest . -v
```

Expected: 所有测试通过（PASS）。

- [ ] **Step 4: 提交**

```bash
git add backend/api/tests/
git commit -m "test: 新增验证码发送、注册、权限相关测试"
```

---

## Task 9: 后端 — 重新生成 OpenAPI Schema

**Files:**
- 自动生成: `frontend/packages/types/api/`

- [ ] **Step 1: 启动后端服务并重新生成前端 API 类型**

确保 Docker 容器正在运行，然后执行：
```bash
docker compose exec web pnpm openapi:generate
```

Expected: `frontend/packages/types/api/` 下自动生成新的 TypeScript 类型，包含 `SendCode`、更新后的 `UserCreate`（含 email/code 字段）等。

- [ ] **Step 2: 提交**

```bash
git add frontend/packages/types/api/
git commit -m "chore: 重新生成 OpenAPI 前端类型"
```

---

## Task 10: 前端 — 安装 next-intl

**Files:**
- Modify: `frontend/apps/web/package.json`（通过 pnpm add）

- [ ] **Step 1: 安装 next-intl**

```bash
docker compose exec web pnpm --filter web add next-intl
```

- [ ] **Step 2: 提交**

```bash
git add frontend/apps/web/package.json frontend/pnpm-lock.yaml
git commit -m "chore: 安装 next-intl 国际化库"
```

---

## Task 11: 前端 — next-intl 配置和翻译文件

**Files:**
- Create: `frontend/packages/ui/locales/en.json`
- Create: `frontend/packages/ui/locales/zh-CN.json`
- Create: `frontend/apps/web/i18n/routing.ts`
- Create: `frontend/apps/web/i18n/request.ts`

- [ ] **Step 1: 创建英文翻译文件**

新建 `frontend/packages/ui/locales/en.json`：
```json
{
  "common": {
    "appName": "Turbo",
    "switchLang": "Language"
  },
  "auth": {
    "login": {
      "title": "Welcome back to Turbo",
      "description": "Get access to internal application",
      "username": "Username",
      "usernamePlaceholder": "Email address or username",
      "password": "Password",
      "passwordPlaceholder": "Enter your password",
      "submit": "Sign in",
      "errorCredentials": "Provided account does not exist.",
      "footerCta": "Don't have an account?",
      "footerLink": "Sign up"
    },
    "register": {
      "title": "Create new account in Turbo",
      "description": "Get access to internal application",
      "username": "Username",
      "usernamePlaceholder": "Unique username",
      "email": "Email",
      "emailPlaceholder": "Your email address",
      "password": "Password",
      "passwordPlaceholder": "Your new password",
      "passwordRetype": "Retype password",
      "passwordRetypePlaceholder": "Verify password",
      "code": "Verification code",
      "codePlaceholder": "6-digit code",
      "sendCode": "Send code",
      "resendCode": "Resend ({seconds}s)",
      "submit": "Sign up",
      "footerCta": "Already have an account?",
      "footerLink": "Sign in",
      "codeSent": "Verification code sent to your email",
      "codeSentError": "Failed to send code, please try again"
    }
  },
  "account": {
    "profile": {
      "title": "Update your profile information",
      "description": "Change your account data",
      "firstName": "First name",
      "lastName": "Last name",
      "submit": "Update profile",
      "success": "Profile has been successfully updated"
    },
    "changePassword": {
      "title": "Set new account password",
      "description": "Change sign in access password",
      "password": "Current password",
      "passwordNew": "New password",
      "passwordRetype": "Retype password",
      "submit": "Change password",
      "success": "Password has been successfully changed"
    },
    "deleteAccount": {
      "title": "Delete your account",
      "description": "After this action all data will be lost",
      "username": "Username",
      "submit": "Delete account"
    }
  },
  "home": {
    "title": "Turbo - Django & Next.js starter kit",
    "description": "Turbo is minimal and opinionated starter kit for Django & Next.js projects connected via REST API.",
    "authenticatedPages": "Authenticated pages",
    "anonymousPages": "Anonymous pages",
    "profile": "Profile",
    "changePassword": "Change password",
    "deleteAccount": "Delete account",
    "login": "Login",
    "register": "Register",
    "logout": "Logout",
    "session": "Session",
    "username": "Username"
  }
}
```

- [ ] **Step 2: 创建中文翻译文件**

新建 `frontend/packages/ui/locales/zh-CN.json`：
```json
{
  "common": {
    "appName": "Turbo",
    "switchLang": "语言"
  },
  "auth": {
    "login": {
      "title": "欢迎回来",
      "description": "登录以访问应用",
      "username": "用户名",
      "usernamePlaceholder": "邮箱地址或用户名",
      "password": "密码",
      "passwordPlaceholder": "请输入密码",
      "submit": "登录",
      "errorCredentials": "账号不存在或密码错误",
      "footerCta": "还没有账号？",
      "footerLink": "注册"
    },
    "register": {
      "title": "创建新账号",
      "description": "注册以访问应用",
      "username": "用户名",
      "usernamePlaceholder": "唯一的用户名",
      "email": "邮箱",
      "emailPlaceholder": "你的邮箱地址",
      "password": "密码",
      "passwordPlaceholder": "你的新密码",
      "passwordRetype": "确认密码",
      "passwordRetypePlaceholder": "再次输入密码",
      "code": "验证码",
      "codePlaceholder": "6位数字验证码",
      "sendCode": "发送验证码",
      "resendCode": "重新发送 ({seconds}s)",
      "submit": "注册",
      "footerCta": "已有账号？",
      "footerLink": "登录",
      "codeSent": "验证码已发送到你的邮箱",
      "codeSentError": "验证码发送失败，请重试"
    }
  },
  "account": {
    "profile": {
      "title": "更新个人资料",
      "description": "修改你的账号信息",
      "firstName": "名",
      "lastName": "姓",
      "submit": "更新资料",
      "success": "个人资料已成功更新"
    },
    "changePassword": {
      "title": "设置新密码",
      "description": "修改登录密码",
      "password": "当前密码",
      "passwordNew": "新密码",
      "passwordRetype": "确认密码",
      "submit": "修改密码",
      "success": "密码已成功修改"
    },
    "deleteAccount": {
      "title": "删除账号",
      "description": "此操作后所有数据将丢失",
      "username": "用户名",
      "submit": "删除账号"
    }
  },
  "home": {
    "title": "Turbo - Django & Next.js 启动模板",
    "description": "Turbo 是一个极简的 Django & Next.js 全栈脚手架，通过 REST API 连接。",
    "authenticatedPages": "已认证页面",
    "anonymousPages": "未认证页面",
    "profile": "个人资料",
    "changePassword": "修改密码",
    "deleteAccount": "删除账号",
    "login": "登录",
    "register": "注册",
    "logout": "退出登录",
    "session": "会话状态",
    "username": "用户名"
  }
}
```

- [ ] **Step 3: 创建 i18n 路由配置**

新建 `frontend/apps/web/i18n/routing.ts`：
```ts
import { defineRouting } from 'next/intl/routing'

export const routing = defineRouting({
  locales: ['en', 'zh-CN'],
  defaultLocale: 'en',
  localePrefix: 'as-needed'
})
```

- [ ] **Step 4: 创建 i18n 请求配置**

新建 `frontend/apps/web/i18n/request.ts`：
```ts
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  if (!locale || !routing.locales.includes(locale as 'en' | 'zh-CN')) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`@frontend/ui/locales/${locale}.json`)).default
  }
})
```

- [ ] **Step 5: 提交**

```bash
git add frontend/packages/ui/locales/ frontend/apps/web/i18n/
git commit -m "feat: 新增翻译文件和 next-intl 配置"
```

---

## Task 12: 前端 — next-intl 中间件和 next.config 集成

**Files:**
- Create: `frontend/apps/web/middleware.ts`
- Modify: `frontend/apps/web/next.config.ts`

- [ ] **Step 1: 创建语言检测中间件**

新建 `frontend/apps/web/middleware.ts`：
```ts
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: ['/', '/(zh-CN|en)/:path*']
}
```

- [ ] **Step 2: 修改 next.config.ts 集成 next-intl**

将 `frontend/apps/web/next.config.ts` 改为：
```ts
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@frontend/types', '@frontend/ui']
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/middleware.ts frontend/apps/web/next.config.ts
git commit -m "feat: 集成 next-intl 中间件和 next.config"
```

---

## Task 13: 前端 — layout 改造 + 语言切换组件

**Files:**
- Modify: `frontend/apps/web/app/layout.tsx`
- Create: `frontend/apps/web/components/language-switcher.tsx`

- [ ] **Step 1: 创建语言切换组件**

新建 `frontend/apps/web/components/language-switcher.tsx`：
```tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'

export function LanguageSwitcher() {
  const t = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const handleChange = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`
    router.refresh()
  }

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded bg-white px-2 py-1 text-sm shadow-sm outline outline-1 outline-gray-900/10 focus:outline-purple-600"
      aria-label={t('switchLang')}
    >
      <option value="en">English</option>
      <option value="zh-CN">中文</option>
    </select>
  )
}
```

- [ ] **Step 2: 改造根 layout**

将 `frontend/apps/web/app/layout.tsx` 改为：
```tsx
import { LanguageSwitcher } from '@/components/language-switcher'
import { AuthProvider } from '@/providers/auth-provider'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { twMerge } from 'tailwind-merge'

import '@frontend/ui/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Turbo - Django & Next.js Bootstrap Template'
}

export default function RootLayout({
  children
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={twMerge(
          'bg-gray-50 text-sm text-gray-700 antialiased',
          inter.className
        )}
      >
        <AuthProvider>
          <div className="px-6">
            <div className="container mx-auto my-12 max-w-6xl">
              <div className="mb-4 flex justify-end">
                <LanguageSwitcher />
              </div>
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/components/language-switcher.tsx frontend/apps/web/app/layout.tsx
git commit -m "feat: 新增语言切换组件并集成到根 layout"
```

---

## Task 14: 前端 — validation.ts 改造 + send-code Action

**Files:**
- Modify: `frontend/apps/web/lib/validation.ts`
- Create: `frontend/apps/web/actions/send-code-action.ts`

- [ ] **Step 1: 改造 registerFormSchema**

在 `frontend/apps/web/lib/validation.ts` 中，将 registerFormSchema 改为：
```ts
const registerFormSchema = z
  .object({
    username: z.string().min(6),
    email: z.string().email(),
    code: z.string().length(6),
    password: z.string().min(8),
    passwordRetype: z.string().min(8)
  })
  .refine((data) => data.password === data.passwordRetype, {
    message: 'Passwords are not matching',
    path: ['passwordRetype']
  })
```

- [ ] **Step 2: 创建发送验证码 Server Action**

新建 `frontend/apps/web/actions/send-code-action.ts`：
```ts
'use server'

import { getApiClient } from '@/lib/api'
import { ApiError } from '@frontend/types/api'

export async function sendCodeAction(
  email: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const apiClient = await getApiClient()
    await apiClient.email.sendCodeCreate({ email })
    return { success: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: 'Failed to send verification code' }
    }
    return { success: false, message: 'Unknown error' }
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/lib/validation.ts frontend/apps/web/actions/send-code-action.ts
git commit -m "feat: 注册 schema 新增邮箱验证码字段，新增发送验证码 Action"
```

---

## Task 15: 前端 — 注册表单改造

**Files:**
- Modify: `frontend/apps/web/components/forms/register-form.tsx`
- Modify: `frontend/apps/web/actions/register-action.ts`

- [ ] **Step 1: 改造注册表单组件**

将 `frontend/apps/web/components/forms/register-form.tsx` 改为：
```tsx
'use client'

import type { RegisterFormSchema, registerAction } from '@/actions/register-action'
import { sendCodeAction } from '@/actions/send-code-action'
import { fieldApiError } from '@/lib/forms'
import { registerFormSchema } from '@/lib/validation'
import { FormFooter } from '@frontend/ui/forms/form-footer'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { signIn } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

export function RegisterForm({
  onSubmitHandler
}: { onSubmitHandler: typeof registerAction }) {
  const t = useTranslations('auth.register')
  const { formState, handleSubmit, register, setError, watch, getValues } =
    useForm<RegisterFormSchema>({
      resolver: zodResolver(registerFormSchema)
    })

  const [countdown, setCountdown] = useState(0)
  const emailValue = watch('email')

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSendCode = async () => {
    const email = getValues('email')
    if (!email) return

    const result = await sendCodeAction(email)
    if (result.success) {
      setCountdown(60)
    }
  }

  return (
    <>
      <FormHeader title={t('title')} description={t('description')} />
      <form method="post" onSubmit={handleSubmit(async (data) => {
        const res = await onSubmitHandler(data)
        if (res === true) { signIn() }
        else if (typeof res !== 'boolean') {
          fieldApiError('username', 'username', res, setError)
          fieldApiError('email', 'email', res, setError)
          fieldApiError('password', 'password', res, setError)
          fieldApiError('password_retype', 'passwordRetype', res, setError)
          fieldApiError('code', 'code', res, setError)
        }
      })}>
        <TextField type="text" register={register('username')} formState={formState} label={t('username')} placeholder={t('usernamePlaceholder')} />
        <TextField type="text" register={register('email')} formState={formState} label={t('email')} placeholder={t('emailPlaceholder')} />
        <div className="mb-6 flex items-end gap-2">
          <div className="flex-1">
            <TextField type="text" register={register('code')} formState={formState} label={t('code')} placeholder={t('codePlaceholder')} />
          </div>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={countdown > 0 || !emailValue}
            className="h-10 rounded bg-gray-100 px-4 text-sm font-medium text-gray-700 outline outline-1 outline-gray-900/10 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {countdown > 0 ? t('resendCode', { seconds: countdown }) : t('sendCode')}
          </button>
        </div>
        <TextField type="password" register={register('password')} formState={formState} label={t('password')} placeholder={t('passwordPlaceholder')} />
        <TextField type="password" register={register('passwordRetype')} formState={formState} label={t('passwordRetype')} placeholder={t('passwordRetypePlaceholder')} />
        <SubmitField>{t('submit')}</SubmitField>
      </form>
      <FormFooter cta={t('footerCta')} link="/login" title={t('footerLink')} />
    </>
  )
}
```

- [ ] **Step 2: 改造 register-action.ts**

将 `frontend/apps/web/actions/register-action.ts` 改为：
```ts
'use server'

import { getApiClient } from '@/lib/api'
import type { registerFormSchema } from '@/lib/validation'
import { ApiError, type UserCreateError } from '@frontend/types/api'
import type { z } from 'zod'

export type RegisterFormSchema = z.infer<typeof registerFormSchema>

export async function registerAction(
  data: RegisterFormSchema
): Promise<UserCreateError | boolean> {
  try {
    const apiClient = await getApiClient()

    await apiClient.users.usersCreate({
      username: data.username,
      email: data.email,
      code: data.code,
      password: data.password,
      password_retype: data.passwordRetype
    })

    return true
  } catch (error) {
    if (error instanceof ApiError) {
      return error.body as UserCreateError
    }
  }

  return false
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/apps/web/components/forms/register-form.tsx frontend/apps/web/actions/register-action.ts
git commit -m "feat: 注册表单增加邮箱和验证码字段"
```

---

## Task 16: 前端 — auth.ts 扩展 isStaff 字段

**Files:**
- Modify: `frontend/apps/web/lib/auth.ts`

- [ ] **Step 1: 在 JWT 和 session callback 中增加 isStaff**

在 `frontend/apps/web/lib/auth.ts` 中：

1. 在 `jwt` callback 中，当 `user` 对象存在时保存额外字段：
```ts
    jwt: async ({ token, user }) => {
      if (user?.username) {
        return {
          ...token,
          ...user,
          isStaff: user.is_staff ?? false
        }
      }
```

2. 在 `session` callback 中，传递 isStaff 到 session：
```ts
    session: async ({ session, token }) => {
      const access = decodeToken(token.access)
      const refresh = decodeToken(token.refresh)

      if (Date.now() / 1000 > access.exp && Date.now() / 1000 > refresh.exp) {
        return Promise.reject({
          error: new Error('Refresh token expired')
        })
      }

      session.user = {
        id: access.user_id,
        username: token.username,
        isStaff: token.isStaff ?? false
      }

      session.refreshToken = token.refresh
      session.accessToken = token.access

      return session
    },
```

3. 在 `authorize` 函数中，需要获取用户的 `is_staff` 字段。在 token 获取成功后，调用一次 usersMe 接口获取：
```ts
      async authorize(credentials) {
        if (credentials === undefined) {
          return null
        }

        try {
          const apiClient = await getApiClient()
          const res = await apiClient.token.tokenCreate({
            username: credentials.username,
            password: credentials.password,
            access: '',
            refresh: ''
          })

          // 获取用户信息以拿到 is_staff
          const userApiClient = new ApiClient({
            BASE: process.env.API_URL,
            HEADERS: {
              Authorization: `Bearer ${res.access}`
            }
          })
          const userInfo = await userApiClient.users.usersMeRetrieve()

          return {
            id: decodeToken(res.access).user_id,
            username: credentials.username,
            access: res.access,
            refresh: res.refresh,
            is_staff: userInfo.is_staff ?? false
          }
        } catch (error) {
          if (error instanceof ApiError) {
            return null
          }
        }

        return null
      }
```

注意：需要确保 `ApiClient` 的导入方式正确。在文件顶部已有通过 `getApiClient` 使用 `ApiClient`，需要显式导入：
```ts
import { ApiClient, ApiError } from '@frontend/types/api'
```

- [ ] **Step 2: 提交**

```bash
git add frontend/apps/web/lib/auth.ts
git commit -m "feat: session 扩展 isStaff 字段支持前端角色判断"
```

---

## Task 17: 前端 — 其他页面 i18n 适配（登录、首页、账号页）

**Files:**
- Modify: `frontend/apps/web/components/forms/login-form.tsx`
- Modify: `frontend/apps/web/components/pages-overview.tsx`
- Modify: `frontend/apps/web/components/user-session.tsx`
- Modify: `frontend/apps/web/components/forms/profile-form.tsx`
- Modify: `frontend/apps/web/components/forms/change-password-form.tsx`
- Modify: `frontend/apps/web/components/forms/delete-account-form.tsx`

- [ ] **Step 1: 改造 login-form.tsx 使用 i18n**

将所有硬编码英文文本替换为 `useTranslations('auth.login')` 的调用：

```tsx
'use client'

import { loginFormSchema } from '@/lib/validation'
import { FormFooter } from '@frontend/ui/forms/form-footer'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { ErrorMessage } from '@frontend/ui/messages/error-message'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

type LoginFormSchema = z.infer<typeof loginFormSchema>

export function LoginForm() {
  const t = useTranslations('auth.login')
  const search = useSearchParams()
  const { register, handleSubmit, formState } = useForm<LoginFormSchema>({
    resolver: zodResolver(loginFormSchema)
  })
  const onSubmitHandler = handleSubmit((data) => {
    signIn('credentials', { username: data.username, password: data.password, callbackUrl: '/' })
  })

  return (
    <>
      <FormHeader title={t('title')} description={t('description')} />
      {search.has('error') && search.get('error') === 'CredentialsSignin' && (
        <ErrorMessage>{t('errorCredentials')}</ErrorMessage>
      )}
      <form method="post" action="/api/auth/callback/credentials" onSubmit={onSubmitHandler}>
        <TextField type="text" register={register('username')} formState={formState} label={t('username')} placeholder={t('usernamePlaceholder')} />
        <TextField type="password" register={register('password', { required: true })} formState={formState} label={t('password')} placeholder={t('passwordPlaceholder')} />
        <SubmitField>{t('submit')}</SubmitField>
      </form>
      <FormFooter cta={t('footerCta')} link="/register" title={t('footerLink')} />
    </>
  )
}
```

- [ ] **Step 2: 改造 profile-form.tsx 使用 i18n**

在文件中引入 `useTranslations('account.profile')`，将所有硬编码文本替换为翻译调用。保持组件逻辑不变。

- [ ] **Step 3: 改造 change-password-form.tsx 使用 i18n**

引入 `useTranslations('account.changePassword')`，替换硬编码文本。

- [ ] **Step 4: 改造 delete-account-form.tsx 使用 i18n**

引入 `useTranslations('account.deleteAccount')`，替换硬编码文本。

- [ ] **Step 5: 改造 pages-overview.tsx 和 user-session.tsx 使用 i18n**

引入 `useTranslations('home')`，替换硬编码文本。

- [ ] **Step 6: 提交**

```bash
git add frontend/apps/web/components/
git commit -m "feat: 所有页面组件适配 i18n"
```

---

## Task 18: 集成测试和验证

**Files:**
- 无新文件

- [ ] **Step 1: 重建 Docker 容器**

```bash
docker compose down
docker compose up --build
```

- [ ] **Step 2: 运行后端测试**

```bash
docker compose exec api uv run -- pytest . -v
```

Expected: 全部 PASS。

- [ ] **Step 3: 验证功能清单**

在浏览器中逐一验证：

- [ ] 访问 `http://localhost:3000`，页面右上角有语言切换下拉框
- [ ] 切换到中文，页面文本变为中文
- [ ] 切换到英文，页面文本变为英文
- [ ] 刷新页面，语言保持
- [ ] 访问注册页，有用户名、邮箱、密码、确认密码、验证码字段
- [ ] 填写邮箱后点击"发送验证码"，按钮进入 60 秒倒计时
- [ ] 收到邮件后填写验证码和其他信息，注册成功
- [ ] 注册后可直接登录（无需管理员激活）
- [ ] Django Admin (`http://localhost:8000/admin/`) 支持中英文

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore: 第一期基础能力建设完成"
```

---

## 自检清单

### Spec 覆盖

| 需求 | 对应 Task |
|------|-----------|
| 前端页面中英文切换 | Task 11-13, 17 |
| Django Admin 中英文 | Task 2 |
| API 错误消息中英文 | Task 2 + Django gettext |
| 邮箱验证码发送 | Task 5 |
| 验证码 5 分钟有效 | Task 6 (serializer validate) |
| 60 秒重发间隔 | Task 5 (SendCodeSerializer) |
| 24 小时 10 次上限 | Task 5 (SendCodeSerializer) |
| 注册后直接可用 | Task 6 (is_active=True) |
| 前端表单校验 | Task 14 |
| 后端校验 | Task 5, 6 |
| 两级 RBAC | Task 7, 16 |
| 管理员查看全部 | Task 7 (IsOwnerOrAdmin) |
| 前端角色判断 | Task 16 (isStaff) |

### Placeholder 扫描

无 TBD、TODO、"implement later" 等占位符。

### 类型一致性

- `registerFormSchema` 中字段名（username, email, code, password, passwordRetype）与 `register-action.ts` 中映射的 API 参数（username, email, code, password, password_retype）一致
- `sendCodeAction` 返回 `{ success, message? }` 与 register-form.tsx 中的使用一致
- `isStaff` 在 auth.ts 的 jwt → session 传递链路一致

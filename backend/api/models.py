import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _

from api.managers import TaskManager


class User(AbstractUser):
    email = models.EmailField(
        _("email"),
        unique=True,
        blank=False,
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


class BoardColumn(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(_("name"), max_length=50)
    slug = models.CharField(_("slug"), max_length=50)
    position = models.IntegerField(_("position"), default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="board_columns",
        verbose_name=_("created by"),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    class Meta:
        db_table = "board_columns"
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(
                fields=["created_by", "slug"],
                name="unique_column_slug_per_user",
            ),
        ]
        verbose_name = _("board column")
        verbose_name_plural = _("board columns")

    def __str__(self):
        return self.name


class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(_("name"), max_length=50)
    color = models.CharField(_("color"), max_length=7)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tags",
        verbose_name=_("created by"),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    class Meta:
        db_table = "tags"
        unique_together = [("created_by", "name")]
        verbose_name = _("tag")
        verbose_name_plural = _("tags")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Task(models.Model):
    PRIORITY_CHOICES = [
        ("high", _("High")),
        ("medium", _("Medium")),
        ("low", _("Low")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(_("title"), max_length=200)
    description = models.TextField(_("description"), blank=True, default="")
    status = models.CharField(
        _("status"), max_length=50, default="todo"
    )
    priority = models.CharField(
        _("priority"), max_length=10, choices=PRIORITY_CHOICES, default="medium"
    )
    due_date = models.DateField(_("due date"), null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name=_("created by"),
    )
    tags = models.ManyToManyField(Tag, through="TaskTag", blank=True, verbose_name=_("tags"))
    is_deleted = models.BooleanField(_("deleted"), default=False)
    deleted_at = models.DateTimeField(_("deleted at"), null=True, blank=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    objects = TaskManager()

    class Meta:
        db_table = "tasks"
        verbose_name = _("task")
        verbose_name_plural = _("tasks")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_by", "status", "is_deleted"], name="idx_task_status"),
            models.Index(fields=["created_by", "is_deleted", "deleted_at"], name="idx_task_trash"),
            models.Index(fields=["is_deleted", "deleted_at"], name="idx_task_cleanup"),
        ]

    def __str__(self):
        return self.title


class TaskTag(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="task_tags")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="task_tags")
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "task_tags"
        unique_together = [("task", "tag")]


class ErrorLog(models.Model):
    """管理端错误日志，由 ErrorCaptureMiddleware 自动捕获 500+ 响应"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(_("timestamp"), auto_now_add=True)
    method = models.CharField(_("method"), max_length=10)
    path = models.CharField(_("path"), max_length=500)
    status_code = models.IntegerField(_("status code"))
    message = models.TextField(_("message"), blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("user"),
    )

    class Meta:
        db_table = "error_logs"
        ordering = ["-timestamp"]
        verbose_name = _("error log")
        verbose_name_plural = _("error logs")
        indexes = [
            models.Index(fields=["-timestamp"], name="idx_error_timestamp"),
        ]

    def __str__(self):
        return f"{self.method} {self.path} - {self.status_code}"


class ChatMessage(models.Model):
    """AI 助手聊天记录"""

    ROLE_CHOICES = [
        ("user", "User"),
        ("assistant", "Assistant"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages",
        verbose_name=_("user"),
    )
    role = models.CharField(_("role"), max_length=10, choices=ROLE_CHOICES)
    content = models.TextField(_("content"))
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "chat_messages"
        verbose_name = _("chat message")
        verbose_name_plural = _("chat messages")
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="idx_chat_user_created"),
        ]

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"


class AIAction(models.Model):
    """AI 工具调用操作记录"""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("executed", "Executed"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
        ("undone", "Undone"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        ChatMessage,
        on_delete=models.CASCADE,
        related_name="actions",
        verbose_name=_("message"),
    )
    tool_name = models.CharField(_("tool name"), max_length=50)
    tool_args = models.JSONField(_("tool args"))
    status = models.CharField(_("status"), max_length=10, choices=STATUS_CHOICES, default="pending")
    result = models.JSONField(_("result"), null=True, blank=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    class Meta:
        db_table = "ai_actions"
        verbose_name = _("AI action")
        verbose_name_plural = _("AI actions")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["message"], name="idx_ai_action_message"),
        ]

    def __str__(self):
        return f"{self.tool_name} ({self.status})"


class DailyUsage(models.Model):
    """AI 助手每日使用额度"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ai_daily_usages",
        verbose_name=_("user"),
    )
    date = models.DateField(_("date"))
    count = models.IntegerField(_("count"), default=0)

    class Meta:
        db_table = "daily_usages"
        verbose_name = _("daily usage")
        verbose_name_plural = _("daily usages")
        constraints = [
            models.UniqueConstraint(fields=["user", "date"], name="uq_daily_usage_user_date"),
        ]

    def __str__(self):
        return f"{self.user} - {self.date}: {self.count}"

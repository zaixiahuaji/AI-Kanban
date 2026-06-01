import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


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

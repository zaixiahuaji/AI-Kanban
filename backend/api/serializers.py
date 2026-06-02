from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions, serializers

from .models import EmailVerification, Tag, Task

User = get_user_model()


class UserCurrentSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "first_name", "last_name"]


class UserCurrentErrorSerializer(serializers.Serializer):
    username = serializers.ListSerializer(child=serializers.CharField(), required=False)
    first_name = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    last_name = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )


class UserChangePasswordSerializer(serializers.ModelSerializer):
    password = serializers.CharField(style={"input_type": "password"}, write_only=True)
    password_new = serializers.CharField(style={"input_type": "password"})
    password_retype = serializers.CharField(
        style={"input_type": "password"}, write_only=True
    )

    default_error_messages = {
        "password_mismatch": _("Current password is not matching"),
        "password_invalid": _("Password does not meet all requirements"),
        "password_same": _("Both new and current passwords are same"),
    }

    class Meta:
        model = User
        fields = ["password", "password_new", "password_retype"]

    def validate(self, attrs):
        request = self.context.get("request", None)

        if not request.user.check_password(attrs["password"]):
            raise serializers.ValidationError(
                {"password": self.default_error_messages["password_mismatch"]}
            )

        try:
            validate_password(attrs["password_new"])
        except ValidationError as e:
            raise exceptions.ValidationError({"password_new": list(e.messages)}) from e

        if attrs["password_new"] != attrs["password_retype"]:
            raise serializers.ValidationError(
                {"password_retype": self.default_error_messages["password_invalid"]}
            )

        if attrs["password_new"] == attrs["password"]:
            raise serializers.ValidationError(
                {"password_new": self.default_error_messages["password_same"]}
            )
        return super().validate(attrs)


class UserChangePasswordErrorSerializer(serializers.Serializer):
    password = serializers.ListSerializer(child=serializers.CharField(), required=False)
    password_new = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    password_retype = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )


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

        # Validate email uniqueness
        if User.objects.filter(email=attrs["email"]).exists():
            raise exceptions.ValidationError(
                {"email": [_("A user with that email already exists.")]}
            )

        # Validate password
        try:
            validate_password(attrs.get("password"))
        except ValidationError as e:
            raise exceptions.ValidationError({"password": list(e.messages)}) from e

        if attrs["password"] != password_retype:
            self.fail("password_mismatch")

        # Validate verification code
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


class UserCreateErrorSerializer(serializers.Serializer):
    username = serializers.ListSerializer(child=serializers.CharField(), required=False)
    email = serializers.ListSerializer(child=serializers.CharField(), required=False)
    code = serializers.ListSerializer(child=serializers.CharField(), required=False)
    password = serializers.ListSerializer(child=serializers.CharField(), required=False)
    password_retype = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )


class SendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()

    default_error_messages = {
        "rate_limit": _("Please wait before requesting another code."),
        "daily_limit": _("Too many verification codes sent today."),
    }

    def validate_email(self, value):
        # 检查 60 秒频率限制
        recent = EmailVerification.objects.filter(
            email=value,
            created_at__gte=timezone.now() - timedelta(seconds=60),
        ).exists()
        if recent:
            self.fail("rate_limit")

        # 检查 24 小时每日限制
        daily_count = EmailVerification.objects.filter(
            email=value,
            created_at__gte=timezone.now() - timedelta(hours=24),
        ).count()
        if daily_count >= 10:
            self.fail("daily_limit")

        return value


######################################################################
# Tag
######################################################################


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "color", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        # 检查同一用户下标签名是否重复
        user = self.context["request"].user
        qs = Tag.objects.filter(created_by=user, name=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(_("A tag with this name already exists."))
        return value


class TagBriefSerializer(serializers.ModelSerializer):
    """任务列表中嵌入的标签摘要"""

    class Meta:
        model = Tag
        fields = ["id", "name", "color"]


######################################################################
# Task
######################################################################


class TaskListSerializer(serializers.ModelSerializer):
    tags = TagBriefSerializer(many=True, read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "title", "status", "priority", "priority_display",
            "due_date", "is_overdue", "tags", "created_at", "modified_at",
        ]

    def get_is_overdue(self, obj):
        if obj.due_date and obj.status != "done":
            from datetime import date
            return obj.due_date < date.today()
        return False


class TaskDetailSerializer(TaskListSerializer):
    description = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta(TaskListSerializer.Meta):
        fields = TaskListSerializer.Meta.fields + ["description", "created_by"]


class TaskCreateSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        default=[],
    )

    class Meta:
        model = Task
        fields = ["title", "description", "status", "priority", "due_date", "tags"]

    def validate_title(self, value):
        if len(value.strip()) < 1:
            raise serializers.ValidationError(_("Title cannot be empty."))
        return value.strip()

    def validate_tags(self, value):
        user = self.context["request"].user
        tags = Tag.objects.filter(id__in=value, created_by=user)
        if len(tags) != len(value):
            raise serializers.ValidationError(_("Some tags do not exist or do not belong to you."))
        return tags

    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        validated_data["created_by"] = self.context["request"].user
        task = Task.objects.create(**validated_data)
        if tags:
            task.tags.set(tags)
        return task


class TaskUpdateSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Task
        fields = ["title", "description", "status", "priority", "due_date", "tags"]

    def validate_tags(self, value):
        if value is None:
            return value
        user = self.context["request"].user
        tags = Tag.objects.filter(id__in=value, created_by=user)
        if len(tags) != len(value):
            raise serializers.ValidationError(_("Some tags do not exist or do not belong to you."))
        return tags

    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tags is not None:
            instance.tags.set(tags)
        return instance

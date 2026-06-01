from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions, serializers

from .models import EmailVerification

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

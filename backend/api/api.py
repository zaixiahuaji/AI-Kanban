import random

from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmailVerification
from .serializers import (
    SendCodeSerializer,
    UserChangePasswordErrorSerializer,
    UserChangePasswordSerializer,
    UserCreateErrorSerializer,
    UserCreateSerializer,
    UserCurrentErrorSerializer,
    UserCurrentSerializer,
)

User = get_user_model()


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


class UserViewSet(
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = User.objects.all()
    serializer_class = UserCurrentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(pk=self.request.user.pk)

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]

        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        elif self.action == "me":
            return UserCurrentSerializer
        elif self.action == "change_password":
            return UserChangePasswordSerializer

        return super().get_serializer_class()

    @extend_schema(
        request=UserCreateSerializer,
        responses={
            201: UserCreateSerializer,
            400: UserCreateErrorSerializer,
        }
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        responses={
            200: UserCurrentSerializer,
            400: UserCurrentErrorSerializer,
        }
    )
    @action(["get", "put", "patch"], detail=False)
    def me(self, request, *args, **kwargs):
        if request.method == "GET":
            serializer = self.get_serializer(self.request.user)
            return Response(serializer.data)
        elif request.method == "PUT":
            serializer = self.get_serializer(
                self.request.user, data=request.data, partial=False
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        elif request.method == "PATCH":
            serializer = self.get_serializer(
                self.request.user, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

    @extend_schema(
        responses={
            204: None,
            400: UserChangePasswordErrorSerializer,
        }
    )
    @action(["post"], url_path="change-password", detail=False)
    def change_password(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        self.request.user.set_password(serializer.data["password_new"])
        self.request.user.save()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(["delete"], url_path="delete-account", detail=False)
    def delete_account(self, request, *args, **kwargs):
        self.request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


######################################################################
# Task & Tag
######################################################################
from django.utils import timezone

from .models import Tag, Task
from .permissions import IsOwnerOrAdmin
from .serializers import (
    TagSerializer,
    TaskCreateSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskUpdateSerializer,
)


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        return Tag.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TaskViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        qs = Task.objects.active()
        if not self.request.user.is_staff:
            qs = qs.filter(created_by=self.request.user)
        return qs.select_related("created_by").prefetch_related("tags")

    def get_serializer_class(self):
        if self.action == "list":
            return TaskListSerializer
        if self.action == "retrieve":
            return TaskDetailSerializer
        if self.action == "create":
            return TaskCreateSerializer
        if self.action in ("update", "partial_update"):
            return TaskUpdateSerializer
        return TaskDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output_serializer = TaskDetailSerializer(serializer.instance)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(request=TaskUpdateSerializer, responses={200: TaskDetailSerializer})
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @extend_schema(request=TaskUpdateSerializer, responses={200: TaskDetailSerializer})
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """软删除"""
        task = self.get_object()
        task.is_deleted = True
        task.deleted_at = timezone.now()
        task.save(update_fields=["is_deleted", "deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        """从回收站恢复"""
        task = self._get_deleted_object()
        if not task.is_deleted:
            return Response(
                {"detail": _("Task is not deleted.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task.is_deleted = False
        task.deleted_at = None
        task.save(update_fields=["is_deleted", "deleted_at"])
        serializer = TaskDetailSerializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=["delete"], url_path="permanent")
    def permanent_destroy(self, request, *args, **kwargs):
        """永久删除"""
        task = self._get_deleted_object()
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _get_deleted_object(self):
        """获取已删除的任务对象（含权限检查）"""
        qs = Task.objects.all()
        if not self.request.user.is_staff:
            qs = qs.filter(created_by=self.request.user)
        obj = qs.get(pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=False, methods=["get"], url_path="trash")
    def trash(self, request):
        """回收站列表"""
        qs = Task.objects.deleted()
        if not request.user.is_staff:
            qs = qs.filter(created_by=request.user)
        qs = qs.select_related("created_by").prefetch_related("tags")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = TaskDetailSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = TaskDetailSerializer(qs, many=True)
        return Response(serializer.data)

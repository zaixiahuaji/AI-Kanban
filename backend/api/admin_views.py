from datetime import timedelta

from django.db import connection
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import (
    DestroyAPIView,
    ListAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BoardColumn, ErrorLog, Task, User
from .admin_serializers import (
    AdminStatsSerializer,
    AdminStatsTrendSerializer,
    AdminTaskBriefSerializer,
    AdminTaskListSerializer,
    AdminUserDetailSerializer,
    AdminUserListSerializer,
    AdminUserUpdateSerializer,
    HealthCheckSerializer,
)


class AdminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


######################################################################
# Stats
######################################################################


class AdminStatsView(APIView):
    """全局统计聚合数据"""

    permission_classes = [IsAdminUser]

    @extend_schema(
        operation_id="admin_stats_retrieve",
        responses=AdminStatsSerializer,
    )
    def get(self, request):
        total_users = User.objects.count()
        total_tasks = Task.objects.filter(is_deleted=False).count()
        completed_tasks = Task.objects.filter(
            is_deleted=False, status="done"
        ).count()
        completion_rate = (
            round(completed_tasks / total_tasks, 2) if total_tasks > 0 else 0
        )
        active_users_today = User.objects.filter(
            last_login__date=timezone.now().date()
        ).count()

        # 按状态分组 — 使用最常见的列名作为 label
        status_counts = (
            Task.objects.filter(is_deleted=False)
            .values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        column_names = {}
        for slug, name in BoardColumn.objects.values_list("slug", "name"):
            column_names.setdefault(slug, name)
        by_status = [
            {
                "status": item["status"],
                "label": column_names.get(item["status"], item["status"]),
                "count": item["count"],
            }
            for item in status_counts
        ]

        # 按优先级分组
        priority_map = dict(Task.PRIORITY_CHOICES)
        priority_counts = (
            Task.objects.filter(is_deleted=False)
            .values("priority")
            .annotate(count=Count("id"))
            .order_by("priority")
        )
        by_priority = [
            {
                "priority": item["priority"],
                "label": priority_map.get(item["priority"], item["priority"]),
                "count": item["count"],
            }
            for item in priority_counts
        ]

        data = {
            "total_users": total_users,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "completion_rate": completion_rate,
            "active_users_today": active_users_today,
            "tasks_by_status": by_status,
            "tasks_by_priority": by_priority,
        }
        serializer = AdminStatsSerializer(data)
        return Response(serializer.data)


class AdminStatsTrendView(APIView):
    """注册与任务创建趋势"""

    permission_classes = [IsAdminUser]

    @extend_schema(
        operation_id="admin_stats_trend_retrieve",
        parameters=[
            OpenApiParameter(name="days", type=int, required=False, default=30),
        ],
        responses=AdminStatsTrendSerializer,
    )
    def get(self, request):
        days = int(request.query_params.get("days", 30))
        start_date = timezone.now().date() - timedelta(days=days)

        registration_trend = (
            User.objects.filter(date_joined__date__gte=start_date)
            .annotate(date=TruncDate("date_joined"))
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
        )

        task_creation_trend = (
            Task.objects.filter(created_at__date__gte=start_date)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
        )

        data = {
            "registration_trend": list(registration_trend),
            "task_creation_trend": list(task_creation_trend),
        }
        serializer = AdminStatsTrendSerializer(data)
        return Response(serializer.data)


######################################################################
# Users
######################################################################


class AdminUserListView(ListAPIView):
    """用户列表（含搜索和状态筛选）"""

    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination
    serializer_class = AdminUserListSerializer

    def get_queryset(self):
        qs = User.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
            )
        status_filter = self.request.query_params.get("status")
        if status_filter == "active":
            qs = qs.filter(is_active=True)
        elif status_filter == "disabled":
            qs = qs.filter(is_active=False)
        return qs.annotate(
            task_count=Count("tasks", filter=Q(tasks__is_deleted=False)),
            tag_count=Count("tags"),
            column_count=Count("board_columns"),
        ).order_by("-date_joined")


class AdminUserDetailView(RetrieveUpdateDestroyAPIView):
    """用户详情 / 修改状态 / 删除用户"""

    permission_classes = [IsAdminUser]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return AdminUserUpdateSerializer
        return AdminUserDetailSerializer

    def get_queryset(self):
        return User.objects.annotate(
            task_count=Count("tasks", filter=Q(tasks__is_deleted=False)),
            tag_count=Count("tags"),
            column_count=Count("board_columns"),
        )

    @extend_schema(
        operation_id="admin_users_retrieve",
        responses=AdminUserDetailSerializer,
    )
    def get(self, request, *args, **kwargs):
        user = self.get_object()
        recent_tasks = (
            Task.objects.filter(created_by=user, is_deleted=False)
            .select_related("created_by")
            .prefetch_related("tags")
            .order_by("-created_at")[:10]
        )
        # 使用 ListSerializer 序列化基本信息（不包含 recent_tasks），
        # 然后手动追加 recent_tasks
        serializer = AdminUserListSerializer(user)
        data = serializer.data
        data["recent_tasks"] = AdminTaskBriefSerializer(
            recent_tasks, many=True
        ).data
        return Response(data)

    @extend_schema(
        operation_id="admin_users_partial_update",
        request=AdminUserUpdateSerializer,
        responses=AdminUserDetailSerializer,
    )
    def patch(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(
        operation_id="admin_users_destroy",
        responses={204: None},
    )
    def delete(self, request, *args, **kwargs):
        user = self.get_object()
        Task.objects.filter(created_by=user).update(
            is_deleted=True, deleted_at=timezone.now()
        )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


######################################################################
# Tasks
######################################################################


class AdminTaskListView(ListAPIView):
    """全局任务列表（含搜索和多维筛选）"""

    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination
    serializer_class = AdminTaskListSerializer

    def get_queryset(self):
        qs = Task.objects.select_related("created_by").prefetch_related("tags")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(title__icontains=search)
        user_id = self.request.query_params.get("user")
        if user_id:
            qs = qs.filter(created_by_id=user_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        priority = self.request.query_params.get("priority")
        if priority:
            qs = qs.filter(priority=priority)
        return qs.order_by("-created_at")


class AdminTaskDetailView(DestroyAPIView):
    """管理员永久删除任务（硬删除）"""

    permission_classes = [IsAdminUser]
    queryset = Task.objects.all()

    @extend_schema(
        operation_id="admin_tasks_destroy",
        responses={204: None},
    )
    def delete(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


######################################################################
# Health Check
######################################################################


class HealthCheckView(APIView):
    """系统健康检查"""

    permission_classes = [IsAdminUser]

    @extend_schema(
        operation_id="admin_health_retrieve",
        responses=HealthCheckSerializer,
    )
    def get(self, request):
        try:
            connection.ensure_connection()
            db_status = "ok"
        except Exception:
            db_status = "error"

        total_users = User.objects.count()
        active_users_today = User.objects.filter(
            last_login__date=timezone.now().date()
        ).count()

        recent_errors = ErrorLog.objects.order_by("-timestamp")[:20]

        cutoff = timezone.now() - timedelta(days=30)
        ErrorLog.objects.filter(timestamp__lt=cutoff).delete()
        excess = ErrorLog.objects.count() - 1000
        if excess > 0:
            oldest_ids = list(
                ErrorLog.objects.order_by("-timestamp")
                .values_list("id", flat=True)[1000:]
            )
            ErrorLog.objects.filter(id__in=oldest_ids).delete()

        data = {
            "database": db_status,
            "total_users": total_users,
            "active_users_today": active_users_today,
            "api_version": "1.0.0",
            "recent_errors": recent_errors,
        }
        serializer = HealthCheckSerializer(data)
        return Response(serializer.data)

from rest_framework import serializers

from .models import ErrorLog, Task, User
from .serializers import TagBriefSerializer


######################################################################
# Admin Stats
######################################################################


class AdminStatusCountSerializer(serializers.Serializer):
    status = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class AdminPriorityCountSerializer(serializers.Serializer):
    priority = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class AdminStatsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    total_tasks = serializers.IntegerField()
    completed_tasks = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    active_users_today = serializers.IntegerField()
    tasks_by_status = AdminStatusCountSerializer(many=True)
    tasks_by_priority = AdminPriorityCountSerializer(many=True)


class TrendItemSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()


class AdminStatsTrendSerializer(serializers.Serializer):
    registration_trend = TrendItemSerializer(many=True)
    task_creation_trend = TrendItemSerializer(many=True)


######################################################################
# Admin Users
######################################################################


class AdminUserListSerializer(serializers.ModelSerializer):
    task_count = serializers.IntegerField()
    tag_count = serializers.IntegerField()
    column_count = serializers.IntegerField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "is_active", "is_staff",
            "task_count", "tag_count", "column_count",
            "date_joined", "last_login",
        ]


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["is_active", "is_staff"]


class AdminTaskBriefSerializer(serializers.Serializer):
    """用户详情中的简要任务信息"""
    id = serializers.UUIDField()
    title = serializers.CharField()
    status = serializers.CharField()
    priority = serializers.CharField()
    tags = TagBriefSerializer(many=True)
    created_at = serializers.DateTimeField()


class AdminUserDetailSerializer(AdminUserListSerializer):
    recent_tasks = AdminTaskBriefSerializer(many=True)

    class Meta(AdminUserListSerializer.Meta):
        fields = AdminUserListSerializer.Meta.fields + ["recent_tasks"]


######################################################################
# Admin Tasks
######################################################################


class AdminUserBriefSerializer(serializers.Serializer):
    """任务列表中的简要用户信息"""
    id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.EmailField()


class AdminTaskListSerializer(serializers.ModelSerializer):
    created_by = AdminUserBriefSerializer()
    tags = TagBriefSerializer(many=True)

    class Meta:
        model = Task
        fields = [
            "id", "title", "status", "priority",
            "created_by", "tags", "is_deleted", "created_at",
        ]


######################################################################
# Health Check
######################################################################


class ErrorLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ErrorLog
        fields = ["timestamp", "method", "path", "status_code", "message"]


class HealthCheckSerializer(serializers.Serializer):
    database = serializers.CharField()
    total_users = serializers.IntegerField()
    active_users_today = serializers.IntegerField()
    api_version = serializers.CharField()
    recent_errors = ErrorLogSerializer(many=True)

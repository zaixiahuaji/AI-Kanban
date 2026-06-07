from rest_framework import serializers

from .models import AIAction, ChatMessage, DailyUsage


class AIActionSerializer(serializers.ModelSerializer):
    """AI 操作记录序列化器"""

    class Meta:
        model = AIAction
        fields = ["id", "tool_name", "tool_args", "status", "result", "created_at"]
        read_only_fields = fields


class ChatMessageSerializer(serializers.ModelSerializer):
    """聊天消息序列化器（含关联操作）"""

    actions = AIActionSerializer(many=True, read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "created_at", "actions"]
        read_only_fields = fields


class ChatRequestSerializer(serializers.Serializer):
    """聊天请求"""

    content = serializers.CharField(max_length=2000)


class DailyUsageSerializer(serializers.Serializer):
    """每日额度"""

    used = serializers.IntegerField()
    limit = serializers.IntegerField()
    remaining = serializers.IntegerField()

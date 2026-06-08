import json
import logging
from datetime import date

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from openai import OpenAI
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai_serializers import (
    ChatMessageSerializer,
    ChatRequestSerializer,
    DailyUsageSerializer,
)
from .ai_tools import (
    CONFIRM_EXECUTORS,
    TOOL_SCHEMAS,
    UNDO_HANDLERS,
    build_system_prompt,
    dispatch_tool,
)
from .models import AIAction, ChatMessage, DailyUsage

logger = logging.getLogger(__name__)


def _get_or_create_daily_usage(user):
    """获取或创建今日额度记录。"""
    today = date.today()
    usage, _ = DailyUsage.objects.get_or_create(user=user, date=today)
    return usage


def _check_rate_limit(user):
    """检查每日额度，返回 (allowed, usage_obj)。"""
    usage = _get_or_create_daily_usage(user)
    return usage.count < settings.AI_DAILY_LIMIT, usage


def _build_messages(user, user_content):
    """构建发送给 DeepSeek 的 messages 列表。"""
    messages = [{"role": "system", "content": build_system_prompt(user)}]

    # 历史消息
    history = (
        ChatMessage.objects.filter(user=user)
        .order_by("-created_at")[: settings.AI_CHAT_HISTORY_LIMIT]
    )
    for msg in reversed(history):
        messages.append({"role": msg.role, "content": msg.content})

    # 当前用户消息
    messages.append({"role": "user", "content": user_content})
    return messages


class AIChatHistoryView(APIView):
    """获取/清空聊天历史"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_chat_history",
        responses=ChatMessageSerializer(many=True),
    )
    def get(self, request):
        messages = (
            ChatMessage.objects.filter(user=request.user)
            .prefetch_related("actions")
            .order_by("-created_at")[: settings.AI_CHAT_HISTORY_LIMIT]
        )
        serializer = ChatMessageSerializer(reversed(messages), many=True)
        return Response({"messages": serializer.data})

    @extend_schema(
        operation_id="ai_chat_history_clear",
        responses={200: None},
    )
    def delete(self, request):
        """清空当前用户的聊天历史"""
        count, _ = ChatMessage.objects.filter(user=request.user).delete()
        return Response({"success": True, "deleted": count})


class AIChatView(APIView):
    """SSE 流式聊天"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_chat",
        request=ChatRequestSerializer,
        responses={(200, "text/event-stream"): None},
    )
    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]

        # 额度检查
        allowed, usage = _check_rate_limit(request.user)
        if not allowed:
            return Response(
                {"detail": "今日额度已用完"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # 保存用户消息
        user_msg = ChatMessage.objects.create(
            user=request.user, role="user", content=content
        )

        # 增加额度计数
        usage.count += 1
        usage.save(update_fields=["count"])

        # 清理历史（保留最近 200 条）
        self._cleanup_history(request.user)

        # SSE 流式响应
        from django.http import StreamingHttpResponse

        response = StreamingHttpResponse(
            self._stream_chat(request.user, content, user_msg),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

    def _stream_chat(self, user, content, user_msg):
        """生成 SSE 事件流。"""
        client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
        messages = _build_messages(user, content)

        assistant_content = ""
        assistant_msg = None

        try:
            for iteration in range(settings.AI_TOOL_MAX_ITERATIONS):
                has_tool_call = False
                stream = client.chat.completions.create(
                    model=settings.DEEPSEEK_MODEL,
                    messages=messages,
                    tools=TOOL_SCHEMAS,
                    stream=True,
                    timeout=settings.AI_TOOL_TIMEOUT,
                )

                current_text = ""
                current_tool_calls = {}

                for chunk in stream:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if not delta:
                        continue

                    # 文本输出
                    if delta.content:
                        current_text += delta.content
                        yield self._sse_event(
                            "message",
                            {"type": "text", "content": delta.content},
                        )

                    # 工具调用（流式累积）
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in current_tool_calls:
                                current_tool_calls[idx] = {
                                    "id": "",
                                    "name": "",
                                    "arguments": "",
                                }
                            if tc.id:
                                current_tool_calls[idx]["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    current_tool_calls[idx]["name"] = (
                                        tc.function.name
                                    )
                                if tc.function.arguments:
                                    current_tool_calls[idx]["arguments"] += (
                                        tc.function.arguments
                                    )

                # 累积文本到完整回复
                assistant_content += current_text

                # 处理工具调用
                if current_tool_calls:
                    has_tool_call = True
                    # 创建 assistant 消息（如果还没有）
                    if not assistant_msg:
                        assistant_msg = ChatMessage.objects.create(
                            user=user,
                            role="assistant",
                            content=assistant_content or "正在处理操作...",
                        )

                    # 将 assistant 回复加入 messages（必须包含 tool_calls）
                    assistant_message = {
                        "role": "assistant",
                        "content": current_text or None,
                        "tool_calls": [
                            {
                                "id": current_tool_calls[idx]["id"],
                                "type": "function",
                                "function": {
                                    "name": current_tool_calls[idx]["name"],
                                    "arguments": current_tool_calls[idx][
                                        "arguments"
                                    ],
                                },
                            }
                            for idx in sorted(current_tool_calls.keys())
                        ],
                    }
                    messages.append(assistant_message)

                    for idx in sorted(current_tool_calls.keys()):
                        tc_data = current_tool_calls[idx]
                        tool_name = tc_data["name"]
                        try:
                            tool_args = json.loads(tc_data["arguments"])
                        except json.JSONDecodeError:
                            tool_args = {}

                        # 分发执行
                        success, result, safety = dispatch_tool(
                            tool_name, user, tool_args
                        )

                        if safety in ("safe", "auto"):
                            # 安全/自动操作：直接执行
                            action_status = "executed" if success else "cancelled"
                        else:
                            # 需确认操作：存为 pending
                            action_status = "pending"

                        action = AIAction.objects.create(
                            message=assistant_msg,
                            tool_name=tool_name,
                            tool_args=tool_args,
                            status=action_status,
                            result=result if success else None,
                        )

                        # 发送 action 事件
                        yield self._sse_event(
                            "message",
                            {
                                "type": "action",
                                "action_id": str(action.id),
                                "tool_name": tool_name,
                                "tool_args": tool_args,
                                "status": action_status,
                                "result": result,
                            },
                        )

                        # 将工具结果回传给 AI
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tc_data["id"],
                                "content": json.dumps(
                                    result, ensure_ascii=False
                                ),
                            }
                        )

                if not has_tool_call:
                    break

        except Exception as e:
            logger.exception("AI chat stream error")
            yield self._sse_event(
                "message",
                {"type": "error", "content": "AI 服务暂时不可用，请稍后重试"},
            )

        # 保存最终的 assistant 消息
        if not assistant_msg:
            assistant_msg = ChatMessage.objects.create(
                user=user,
                role="assistant",
                content=assistant_content or "",
            )
        elif assistant_content and assistant_msg.content != assistant_content:
            assistant_msg.content = assistant_content
            assistant_msg.save(update_fields=["content"])

        yield self._sse_event("message", {"type": "done"})

    def _sse_event(self, event_type, data):
        """格式化 SSE 事件。"""
        return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    def _cleanup_history(self, user):
        """保留最近 200 条历史，删除更早的。"""
        old_ids = list(
            ChatMessage.objects.filter(user=user)
            .order_by("-created_at")
            .values_list("id", flat=True)[200:]
        )
        if old_ids:
            ChatMessage.objects.filter(id__in=old_ids).delete()


class AIActionConfirmView(APIView):
    """确认待执行操作"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_action_confirm",
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            action = AIAction.objects.get(
                id=pk, message__user=request.user, status="pending"
            )
        except AIAction.DoesNotExist:
            return Response(
                {"detail": "操作不存在或已处理"},
                status=status.HTTP_404_NOT_FOUND,
            )

        executor = CONFIRM_EXECUTORS.get(action.tool_name)
        if not executor:
            return Response(
                {"detail": "无法确认该操作"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        success, result = executor(request.user, action.tool_args)
        action.status = "confirmed" if success else "cancelled"
        action.result = result
        action.save(update_fields=["status", "result"])

        return Response(
            {
                "success": success,
                "action_id": str(action.id),
                "tool_name": action.tool_name,
                "result": result,
            }
        )


class AIActionCancelView(APIView):
    """取消待执行操作"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_action_cancel",
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            action = AIAction.objects.get(
                id=pk, message__user=request.user, status="pending"
            )
        except AIAction.DoesNotExist:
            return Response(
                {"detail": "操作不存在或已处理"},
                status=status.HTTP_404_NOT_FOUND,
            )

        action.status = "cancelled"
        action.save(update_fields=["status"])

        return Response(
            {
                "success": True,
                "action_id": str(action.id),
                "status": "cancelled",
            }
        )


class AIActionUndoView(APIView):
    """撤销已执行操作"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_action_undo",
        responses={200: None},
    )
    def post(self, request, pk):
        try:
            action = AIAction.objects.get(
                id=pk,
                message__user=request.user,
                status__in=["executed", "confirmed"],
            )
        except AIAction.DoesNotExist:
            return Response(
                {"detail": "操作不存在或无法撤销"},
                status=status.HTTP_404_NOT_FOUND,
            )

        undo_handler = UNDO_HANDLERS.get(action.tool_name)
        if not undo_handler:
            return Response(
                {"detail": "该操作不支持撤销"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # undo 需要从 result 取数据的操作（包含执行结果如 previous_status、deleted 列表）
        _undo_from_result = {"move_task", "batch_delete_tasks", "batch_move_tasks", "delete_column", "delete_task"}
        if action.tool_name in _undo_from_result:
            success, result = undo_handler(request.user, action.result or {})
        else:
            success, result = undo_handler(request.user, action.tool_args)

        if success:
            action.status = "undone"
            action.save(update_fields=["status"])

        return Response(
            {
                "success": success,
                "action_id": str(action.id),
                "status": "undone" if success else action.status,
                "result": result,
            }
        )


class AIUsageView(APIView):
    """获取今日额度"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="ai_usage",
        responses=DailyUsageSerializer,
    )
    def get(self, request):
        usage = _get_or_create_daily_usage(request.user)
        return Response(
            {
                "used": usage.count,
                "limit": settings.AI_DAILY_LIMIT,
                "remaining": max(0, settings.AI_DAILY_LIMIT - usage.count),
            }
        )

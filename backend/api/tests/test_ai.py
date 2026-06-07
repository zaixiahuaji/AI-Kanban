import json
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status

from api.models import AIAction, BoardColumn, ChatMessage, DailyUsage, Tag, Task


######################################################################
# Models
######################################################################


@pytest.mark.django_db
class TestAIModels:
    def test_create_chat_message(self, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="user", content="你好"
        )
        assert msg.role == "user"
        assert msg.content == "你好"

    def test_create_ai_action(self, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="assistant", content="好的"
        )
        action = AIAction.objects.create(
            message=msg,
            tool_name="list_tasks",
            tool_args={},
            status="executed",
            result={"tasks": []},
        )
        assert action.tool_name == "list_tasks"
        assert action.status == "executed"

    def test_daily_usage_unique(self, regular_user):
        DailyUsage.objects.create(user=regular_user, date=date.today(), count=5)
        with pytest.raises(Exception):
            DailyUsage.objects.create(user=regular_user, date=date.today(), count=3)


######################################################################
# Tool Handlers
######################################################################


@pytest.mark.django_db
class TestToolHandlers:
    def test_list_tasks(self, regular_user):
        Task.objects.create(title="任务A", status="todo", created_by=regular_user)
        Task.objects.create(
            title="任务B", status="done", priority="high", created_by=regular_user
        )
        from api.ai_tools import handle_list_tasks

        success, result = handle_list_tasks(regular_user, {})
        assert success
        assert result["count"] == 2

    def test_list_tasks_filter_status(self, regular_user):
        Task.objects.create(title="任务A", status="todo", created_by=regular_user)
        Task.objects.create(title="任务B", status="done", created_by=regular_user)
        from api.ai_tools import handle_list_tasks

        success, result = handle_list_tasks(regular_user, {"status": "done"})
        assert success
        assert result["count"] == 1

    def test_list_columns(self, regular_user):
        BoardColumn.objects.create(
            name="待办", slug="todo", position=0, created_by=regular_user
        )
        from api.ai_tools import handle_list_columns

        success, result = handle_list_columns(regular_user, {})
        assert success
        assert len(result["columns"]) == 1
        assert result["columns"][0]["name"] == "待办"

    def test_create_task(self, regular_user):
        from api.ai_tools import handle_create_task

        success, result = handle_create_task(
            regular_user, {"title": "新任务", "priority": "high"}
        )
        assert success
        assert result["title"] == "新任务"
        assert Task.objects.filter(title="新任务").exists()

    def test_create_task_empty_title(self, regular_user):
        from api.ai_tools import handle_create_task

        success, result = handle_create_task(regular_user, {"title": ""})
        assert not success

    def test_move_task(self, regular_user):
        Task.objects.create(title="测试任务", status="todo", created_by=regular_user)
        BoardColumn.objects.create(
            name="进行中", slug="in_progress", position=1, created_by=regular_user
        )
        from api.ai_tools import handle_move_task

        success, result = handle_move_task(
            regular_user,
            {"task_title": "测试", "target_column": "进行中"},
        )
        assert success
        assert result["previous_status"] == "todo"
        assert result["to"] == "in_progress"

    def test_move_task_not_found(self, regular_user):
        from api.ai_tools import handle_move_task

        success, result = handle_move_task(
            regular_user,
            {"task_title": "不存在", "target_column": "todo"},
        )
        assert not success

    def test_create_column(self, regular_user):
        from api.ai_tools import handle_create_column

        success, result = handle_create_column(
            regular_user, {"name": "审核中"}
        )
        assert success
        assert result["name"] == "审核中"

    def test_reorder_columns(self, regular_user):
        BoardColumn.objects.create(
            name="待办", slug="todo", position=0, created_by=regular_user
        )
        BoardColumn.objects.create(
            name="完成", slug="done", position=1, created_by=regular_user
        )
        from api.ai_tools import handle_reorder_columns

        success, result = handle_reorder_columns(
            regular_user, {"column_names": ["完成", "待办"]}
        )
        assert success
        assert result["order"] == ["完成", "待办"]

    def test_dispatch_unknown_tool(self, regular_user):
        from api.ai_tools import dispatch_tool

        success, result, safety = dispatch_tool("unknown_tool", regular_user, {})
        assert not success

    def test_dispatch_safe_tool_auto_executes(self, regular_user):
        Task.objects.create(title="测试", status="todo", created_by=regular_user)
        from api.ai_tools import dispatch_tool

        success, result, safety = dispatch_tool("list_tasks", regular_user, {})
        assert success
        assert safety == "safe"

    def test_dispatch_confirm_tool_returns_pending(self, regular_user):
        Task.objects.create(title="测试", status="todo", created_by=regular_user)
        from api.ai_tools import dispatch_tool

        success, result, safety = dispatch_tool(
            "delete_task", regular_user, {"task_title": "测试"}
        )
        assert success
        assert safety == "confirm"


######################################################################
# Confirm Executors
######################################################################


@pytest.mark.django_db
class TestConfirmExecutors:
    def test_execute_delete_task(self, regular_user):
        task = Task.objects.create(title="要删除的", status="todo", created_by=regular_user)
        from api.ai_tools import execute_delete_task

        success, result = execute_delete_task(
            regular_user, {"task_title": "要删除的"}
        )
        assert success
        task.refresh_from_db()
        assert task.is_deleted is True

    def test_execute_batch_move_tasks(self, regular_user):
        t1 = Task.objects.create(title="A", status="todo", created_by=regular_user)
        t2 = Task.objects.create(title="B", status="todo", created_by=regular_user)
        from api.ai_tools import execute_batch_move_tasks

        success, result = execute_batch_move_tasks(
            regular_user,
            {
                "found": [
                    {"title": "A", "id": str(t1.id)},
                    {"title": "B", "id": str(t2.id)},
                ],
                "target_column": "in_progress",
            },
        )
        assert success
        t1.refresh_from_db()
        assert t1.status == "in_progress"


######################################################################
# Undo Handlers
######################################################################


@pytest.mark.django_db
class TestUndoHandlers:
    def test_undo_create_task(self, regular_user):
        from api.ai_tools import handle_create_task, undo_create_task

        _, create_result = handle_create_task(
            regular_user, {"title": "临时任务"}
        )
        success, result = undo_create_task(regular_user, create_result)
        assert success
        assert not Task.objects.filter(title="临时任务", is_deleted=False).exists()

    def test_undo_move_task(self, regular_user):
        Task.objects.create(title="移动测试", status="todo", created_by=regular_user)
        BoardColumn.objects.create(
            name="进行中", slug="in_progress", position=1, created_by=regular_user
        )
        from api.ai_tools import handle_move_task, undo_move_task

        _, move_result = handle_move_task(
            regular_user,
            {"task_title": "移动", "target_column": "进行中"},
        )
        success, result = undo_move_task(regular_user, move_result)
        assert success
        task = Task.objects.get(title="移动测试")
        assert task.status == "todo"


######################################################################
# System Prompt
######################################################################


@pytest.mark.django_db
class TestSystemPrompt:
    def test_build_system_prompt(self, regular_user):
        BoardColumn.objects.create(
            name="待办", slug="todo", position=0, created_by=regular_user
        )
        from api.ai_tools import build_system_prompt

        prompt = build_system_prompt(regular_user)
        assert "待办" in prompt
        assert "看板任务管理助手" in prompt


######################################################################
# API Views
######################################################################


@pytest.mark.django_db
class TestAIChatHistoryView:
    def test_get_history_empty(self, api_client, regular_user):
        api_client.force_authenticate(regular_user)
        response = api_client.get("/api/ai/chat/history/")
        assert response.status_code == 200
        assert response.data["messages"] == []

    def test_get_history_with_messages(self, api_client, regular_user):
        ChatMessage.objects.create(user=regular_user, role="user", content="你好")
        ChatMessage.objects.create(user=regular_user, role="assistant", content="你好！")
        api_client.force_authenticate(regular_user)
        response = api_client.get("/api/ai/chat/history/")
        assert response.status_code == 200
        assert len(response.data["messages"]) == 2

    def test_get_history_unauthenticated(self, api_client):
        response = api_client.get("/api/ai/chat/history/")
        assert response.status_code in (401, 403)


@pytest.mark.django_db
class TestAIUsageView:
    def test_get_usage(self, api_client, regular_user):
        api_client.force_authenticate(regular_user)
        response = api_client.get("/api/ai/usage/")
        assert response.status_code == 200
        assert response.data["limit"] == 50
        assert response.data["remaining"] == 50

    def test_get_usage_after_chat(self, api_client, regular_user):
        DailyUsage.objects.create(user=regular_user, date=date.today(), count=5)
        api_client.force_authenticate(regular_user)
        response = api_client.get("/api/ai/usage/")
        assert response.data["used"] == 5
        assert response.data["remaining"] == 45


@pytest.mark.django_db
class TestAIRateLimit:
    def test_chat_returns_429_when_limit_reached(self, api_client, regular_user):
        DailyUsage.objects.create(user=regular_user, date=date.today(), count=50)
        api_client.force_authenticate(regular_user)
        response = api_client.post(
            "/api/ai/chat/",
            {"content": "测试"},
            format="json",
        )
        assert response.status_code == 429


@pytest.mark.django_db
class TestAIActionViews:
    def test_confirm_pending_action(self, api_client, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="assistant", content="确认删除？"
        )
        task = Task.objects.create(title="要删除的", created_by=regular_user)
        action = AIAction.objects.create(
            message=msg,
            tool_name="delete_task",
            tool_args={"task_title": "要删除的"},
            status="pending",
        )
        api_client.force_authenticate(regular_user)
        response = api_client.post(f"/api/ai/actions/{action.id}/confirm/")
        assert response.status_code == 200
        assert response.data["success"] is True
        action.refresh_from_db()
        assert action.status == "confirmed"

    def test_cancel_pending_action(self, api_client, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="assistant", content="确认删除？"
        )
        action = AIAction.objects.create(
            message=msg,
            tool_name="delete_task",
            tool_args={"task_title": "test"},
            status="pending",
        )
        api_client.force_authenticate(regular_user)
        response = api_client.post(f"/api/ai/actions/{action.id}/cancel/")
        assert response.status_code == 200
        action.refresh_from_db()
        assert action.status == "cancelled"

    def test_undo_executed_action(self, api_client, regular_user):
        msg = ChatMessage.objects.create(
            user=regular_user, role="assistant", content="已创建"
        )
        task = Task.objects.create(title="AI 创建的", created_by=regular_user)
        action = AIAction.objects.create(
            message=msg,
            tool_name="create_task",
            tool_args={"title": "AI 创建的", "task_id": str(task.id)},
            status="executed",
            result={"task_id": str(task.id), "title": "AI 创建的"},
        )
        api_client.force_authenticate(regular_user)
        response = api_client.post(f"/api/ai/actions/{action.id}/undo/")
        assert response.status_code == 200
        assert response.data["success"] is True
        action.refresh_from_db()
        assert action.status == "undone"

    def test_confirm_nonexistent_action(self, api_client, regular_user):
        api_client.force_authenticate(regular_user)
        response = api_client.post(
            "/api/ai/actions/00000000-0000-0000-0000-000000000000/confirm/"
        )
        assert response.status_code == 404

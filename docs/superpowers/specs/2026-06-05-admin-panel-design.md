# 第5期：管理端（3001 端口） 设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 monorepo 中新建独立的管理端前端应用（3001 端口），提供用户管理、全局统计、任务管理、系统健康检查四大模块。

**Architecture:** 在 `frontend/apps/admin/` 新建 Next.js 应用，复用 `@frontend/ui` 组件库和 `@frontend/types` API 类型。后端在现有 Django 项目中新增 `/api/admin/` 前缀的管理接口，使用 `IsAdminUser` 权限。独立登录认证。

**Tech Stack:** Next.js 16 App Router, Tailwind CSS, Recharts, shadcn 风格组件, react-hook-form, next-intl

---

## 1. 项目结构

```
frontend/apps/admin/                  # 新建
├── package.json                      # @frontend/admin
├── next.config.ts                    # port: 3001
├── tailwind.config.ts                # 复用 @frontend/ui
├── middleware.ts                      # staff 权限检查
├── app/
│   ├── layout.tsx                    # 管理端根布局
│   ├── login/
│   │   └── page.tsx                  # 管理端独立登录页
│   └── (admin)/                      # 需要认证的管理路由
│       ├── layout.tsx                # 侧边栏 + 主区域
│       ├── page.tsx                  # 数据总览仪表盘
│       ├── users/
│       │   ├── page.tsx              # 用户列表
│       │   └── [id]/page.tsx         # 用户详情
│       ├── tasks/
│       │   └── page.tsx              # 全局任务列表
│       └── system/
│           └── page.tsx              # 系统健康检查
├── components/
│   ├── admin-sidebar.tsx             # 管理端侧边栏
│   ├── admin-header.tsx              # 顶部栏
│   ├── stats-cards.tsx               # 统计卡片组件
│   ├── user-table.tsx                # 用户表格
│   ├── task-table.tsx                # 任务表格
│   └── health-status.tsx             # 健康检查状态组件
└── actions/
    ├── admin-auth-actions.ts         # 管理端登录 action
    ├── admin-stats-actions.ts        # 统计数据 action
    ├── admin-users-actions.ts        # 用户管理 action
    ├── admin-tasks-actions.ts        # 任务管理 action
    └── admin-health-actions.ts       # 健康检查 action
```

---

## 2. 后端 API

### 2.1 新增管理端路由

在 `backend/api/urls.py` 新增：

```python
urlpatterns = [
    # ... 现有路由 ...
    path("api/admin/stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("api/admin/stats/trend/", AdminStatsTrendView.as_view(), name="admin-stats-trend"),
    path("api/admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("api/admin/users/<uuid:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("api/admin/tasks/", AdminTaskListView.as_view(), name="admin-tasks"),
    path("api/admin/tasks/<uuid:pk>/", AdminTaskDetailView.as_view(), name="admin-task-detail"),
    path("api/admin/health/", HealthCheckView.as_view(), name="admin-health"),
]
```

### 2.2 权限

所有管理端接口使用 `permission_classes = [IsAdminUser]`（Django 内置，检查 `request.user.is_staff`）。

### 2.3 接口详情

#### 数据总览

**`GET /api/admin/stats/`**

```json
{
  "total_users": 156,
  "total_tasks": 2847,
  "completed_tasks": 1936,
  "completion_rate": 0.68,
  "active_users_today": 42,
  "tasks_by_status": [
    {"status": "todo", "label": "待办", "count": 523},
    {"status": "in_progress", "label": "进行中", "count": 388},
    {"status": "done", "label": "完成", "count": 1936}
  ],
  "tasks_by_priority": [
    {"priority": "high", "label": "高", "count": 412},
    {"priority": "medium", "label": "中", "count": 1523},
    {"priority": "low", "label": "低", "count": 912}
  ]
}
```

**`GET /api/admin/stats/trend/?days=30`**

```json
{
  "registration_trend": [
    {"date": "2026-06-01", "count": 5},
    {"date": "2026-06-02", "count": 8}
  ],
  "task_creation_trend": [
    {"date": "2026-06-01", "count": 23},
    {"date": "2026-06-02", "count": 31}
  ]
}
```

#### 用户管理

**`GET /api/admin/users/?search=&status=&page=&page_size=20`**

```json
{
  "results": [
    {
      "id": "uuid",
      "username": "user1",
      "email": "user1@example.com",
      "is_active": true,
      "is_staff": false,
      "task_count": 42,
      "tag_count": 8,
      "column_count": 3,
      "date_joined": "2026-01-15T10:30:00Z",
      "last_login": "2026-06-04T15:20:00Z"
    }
  ],
  "count": 156,
  "next": "...",
  "previous": null
}
```

**`GET /api/admin/users/{id}/`** — 用户详情，额外包含最近任务列表

**`PATCH /api/admin/users/{id}/`** — 修改用户（`is_active`, `is_staff`）

**`DELETE /api/admin/users/{id}/`** — 删除用户及其所有数据（二次确认）。执行流程：先软删除用户所有任务，再调用 `user.delete()` 由 Django CASCADE 自动删除关联数据

#### 任务管理

**`GET /api/admin/tasks/?search=&user=&status=&priority=&page=&page_size=20`**

```json
{
  "results": [
    {
      "id": "uuid",
      "title": "任务标题",
      "status": "todo",
      "priority": "high",
      "created_by": {
        "id": "uuid",
        "username": "user1",
        "email": "user1@example.com"
      },
      "tags": [
        {"id": "uuid", "name": "标签名", "color": "#3B82F6"}
      ],
      "is_deleted": false,
      "created_at": "2026-06-01T10:30:00Z"
    }
  ],
  "count": 2847,
  "next": "...",
  "previous": null
}
```

**`DELETE /api/admin/tasks/{id}/`** — 管理员永久删除任务（硬删除，不经过回收站）

#### 系统健康检查

**`GET /api/admin/health/`**

```json
{
  "database": "ok",
  "total_users": 156,
  "active_users_today": 42,
  "api_version": "1.0.0",
  "recent_errors": [
    {"timestamp": "2026-06-05T01:23:45Z", "method": "GET", "path": "/api/tasks/", "status": 500, "message": "..."}
  ]
}
```

### 2.4 新增 Serializer

在 `backend/api/serializers.py` 新增管理端序列化器：

- `AdminUserListSerializer` — 用户列表（含 task_count, tag_count 聚合）
- `AdminUserDetailSerializer` — 用户详情（含最近任务）
- `AdminTaskListSerializer` — 任务列表（含 created_by 用户信息）
- `AdminStatsSerializer` — 全局统计数据
- `AdminStatsTrendSerializer` — 趋势数据
- `HealthCheckSerializer` — 健康检查数据

### 2.5 新增 View

在 `backend/api/api.py` 或新建 `backend/api/admin_views.py`：

- `AdminStatsView(APIView)` — 聚合查询
- `AdminStatsTrendView(APIView)` — 按天聚合趋势
- `AdminUserListView(ListAPIView)` — 分页列表
- `AdminUserDetailView(RetrieveUpdateDestroyAPIView)` — 详情/修改/删除
- `AdminTaskListView(ListAPIView)` — 分页列表
- `AdminTaskDetailView(DestroyAPIView)` — 删除
- `HealthCheckView(APIView)` — 健康检查

---

## 3. 前端功能模块

### 3.1 登录页与认证机制

- 复用用户端登录页的设计语言（极简灰调）
- **认证方式**：管理端使用独立的 NextAuth 配置（`lib/admin-auth.ts`）
  - 同样使用 `CredentialsProvider`，调用同一 `/api/token/` 获取 JWT
  - 在 `authorize` 回调中额外检查 `is_staff`：非 staff 返回 `null`（显示"无管理员权限"错误）
  - Session 中包含 `isStaff` 字段，供 middleware 检查
- 管理端使用独立的 cookie name（`admin-nextauth.*`），避免与用户端 session 冲突
- `middleware.ts` 逻辑：`getServerSession(adminAuthOptions)` → 无 session 或非 staff → 重定向 `/login`

### 3.2 侧边栏

```
┌──────────────┐
│  Turbo Admin │
├──────────────┤
│ 📊 数据总览   │
│ 👥 用户管理   │
│ 📋 任务管理   │
│ 🔧 系统监控   │
├──────────────┤
│  管理员名     │
│  退出登录     │
└──────────────┘
```

### 3.3 数据总览页（首页）

- 4 个统计卡片：总用户、总任务、完成率、今日活跃
- 注册趋势折线图（近30天，使用 Recharts `LineChart`）
- 任务状态分布环形图（从 `apps/web/components/statistics/` 抽取到 `packages/ui/charts/` 共享，使用 i18n key 替换硬编码中文）
- 优先级分布环形图（同上抽取方式）

### 3.4 用户管理页

- 顶部：搜索框 + 状态筛选下拉（全部/活跃/禁用）
- 表格列：用户名、邮箱、任务数、标签数、注册日期、最后登录、状态、操作
- 操作按钮：查看详情、禁用/启用、删除
- 删除操作弹出确认对话框
- 分页组件

**用户详情页**：
- 基本信息卡片
- 统计摘要（任务数、标签数、列数）
- 最近任务列表（最新10条）

### 3.5 任务管理页

- 顶部：搜索框 + 用户筛选 + 状态筛选 + 优先级筛选
- 表格列：标题、所属用户、状态、优先级、标签、创建时间、操作
- 操作按钮：删除
- 删除操作弹出确认对话框
- 分页组件

### 3.6 系统健康检查页

- 数据库状态指示灯（绿色 ✅ / 红色 ❌）
- 统计数字：总用户、今日活跃
- API 版本号
- 最近错误日志表格（时间、方法、路径、状态码、消息）

---

## 4. Docker 配置

在 `docker-compose.yml` 新增 admin 服务。Dockerfile 复用现有 web 服务的构建方式，仅修改启动命令：

```yaml
admin:
  build:
    context: ./frontend
    dockerfile: apps/admin/Dockerfile  # 基于 web 的 Dockerfile，CMD 改为 pnpm --filter admin dev
  ports:
    - "3001:3000"
  environment:
    - API_URL=http://api:8000
    - NEXTAUTH_URL=http://localhost:3001
    - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
  depends_on:
    - api
```

---

## 5. pnpm workspace 配置

验证 `frontend/pnpm-workspace.yaml` 已包含 `apps/*`（现有配置已满足，无需修改）。

---

## 6. 实现注意事项

1. **图表组件复用**：将 `status-donut-chart.tsx` 和 `priority-donut-chart.tsx` 从 `apps/web/components/statistics/` 抽取到 `packages/ui/charts/`，用 i18n key 替换硬编码中文文本。数据格式与用户端一致，`total` 由前端从返回数据中计算
2. **openapi:generate**：新增的管理端接口需要运行 `pnpm openapi:generate` 更新前端类型
3. **权限检查**：`middleware.ts` 使用 `getServerSession(adminAuthOptions)` 检查 session，无 session 或 `isStaff !== true` 时重定向到 `/login`
4. **用户删除**：Django CASCADE 自动处理关联数据删除（Task→User, Tag→User, BoardColumn→User 均为 `on_delete=CASCADE`）。注意 TaskTag 通过 Task 间接级联
5. **错误日志**：新增 `ErrorLog` 模型存储最近 500 错误。通过 Django middleware 捕获 `response.status_code >= 500` 的请求并写入数据库。保留最近 1000 条，自动清理 30 天前的记录
6. **分页**：管理端表格统一使用后端分页，默认 `page_size=20`

# 数据可视化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增个人数据统计页，以 2×2 网格展示状态分布、优先级分布、标签分布、状态数量 4 个图表。

**Architecture:** 后端新增 `GET /api/statistics/` 专用聚合端点，使用 Django ORM `annotate(Count)` 返回分组统计数据。前端新增 `/statistics` 页面，通过 Server Action 调用生成的 API client 获取数据，用 Recharts 渲染 4 个独立图表组件。侧边栏新增导航入口。

**Tech Stack:** Django REST Framework + drf-spectacular（后端），Recharts + Next.js App Router（前端）

---

## File Structure

| 操作 | 文件路径 | 职责 |
|------|----------|------|
| Create | `backend/api/serializers.py`（追加） | `StatisticsSerializer` 及嵌套 serializer |
| Create | `backend/api/api.py`（追加） | `StatisticsViewSet` |
| Modify | `backend/api/urls.py` | 注册 statistics 路由 |
| Create | `backend/api/tests/test_statistics.py` | 统计 API 测试 |
| Create | `frontend/apps/web/actions/statistics-actions.ts` | Server Action |
| Create | `frontend/apps/web/app/(dashboard)/statistics/page.tsx` | 统计页 Server Component |
| Create | `frontend/apps/web/components/statistics/stats-page-client.tsx` | 客户端主组件 |
| Create | `frontend/apps/web/components/statistics/status-donut-chart.tsx` | 状态分布环形图 |
| Create | `frontend/apps/web/components/statistics/priority-donut-chart.tsx` | 优先级分布环形图 |
| Create | `frontend/apps/web/components/statistics/tag-bar-chart.tsx` | 标签分布横向柱状图 |
| Create | `frontend/apps/web/components/statistics/status-bar-chart.tsx` | 状态数量横向柱状图 |
| Create | `frontend/apps/web/components/statistics/stats-empty-state.tsx` | 空状态组件 |
| Modify | `frontend/apps/web/components/sidebar.tsx` | 新增统计导航项 |
| Modify | `frontend/packages/ui/locales/zh-CN.json` | 新增 statistics i18n |
| Modify | `frontend/packages/ui/locales/en.json` | 新增 statistics i18n |

---

### Task 1: 后端 Serializer

**Files:**
- Modify: `backend/api/serializers.py`（文件末尾追加）

- [ ] **Step 1: 在 `backend/api/serializers.py` 末尾追加统计相关 serializer**

在文件末尾追加以下代码：

```python
######################################################################
# Statistics
######################################################################


class StatusCountSerializer(serializers.Serializer):
    status = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class PriorityCountSerializer(serializers.Serializer):
    priority = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class TagCountSerializer(serializers.Serializer):
    tag_id = serializers.UUIDField()
    name = serializers.CharField()
    color = serializers.CharField()
    count = serializers.IntegerField()


class StatisticsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    by_status = StatusCountSerializer(many=True)
    by_priority = PriorityCountSerializer(many=True)
    by_tag = TagCountSerializer(many=True)
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/serializers.py
git commit -m "feat: 新增统计 serializer 定义"
```

---

### Task 2: 后端 ViewSet + URL

**Files:**
- Modify: `backend/api/api.py`（追加 StatisticsViewSet）
- Modify: `backend/api/urls.py`（注册路由）

- [ ] **Step 1: 在 `backend/api/api.py` 末尾追加 `StatisticsViewSet`**

在文件末尾追加以下代码（注意 import 需要新增 `Count`）：

首先在文件顶部的 import 区域追加：
```python
from django.db.models import Count
```

然后在文件末尾追加：
```python
######################################################################
# Statistics
######################################################################


class StatisticsViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """当前用户的任务统计聚合数据"""

    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    @extend_schema(responses=StatisticsSerializer)
    def list(self, request, *args, **kwargs):
        user = request.user

        # 基础 queryset：当前用户未删除的任务
        base_qs = Task.objects.filter(created_by=user, is_deleted=False)

        # 总数
        total = base_qs.count()

        # 按状态分组计数，并从 BoardColumn 获取 label
        status_counts = (
            base_qs.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        # 构建 slug -> name 映射
        column_map = dict(
            BoardColumn.objects.filter(created_by=user).values_list("slug", "name")
        )
        by_status = [
            {
                "status": item["status"],
                "label": column_map.get(item["status"], item["status"]),
                "count": item["count"],
            }
            for item in status_counts
        ]

        # 按优先级分组计数
        priority_map = dict(Task.PRIORITY_CHOICES)
        priority_counts = (
            base_qs.values("priority")
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

        # 按标签分组计数（只统计用户自己的标签）
        by_tag = list(
            Tag.objects.filter(created_by=user)
            .annotate(
                count=Count("tasks", filter=Q(tasks__is_deleted=False))
            )
            .filter(count__gt=0)
            .values("id", "name", "color", "count")
            .order_by("-count")
        )
        by_tag = [
            {
                "tag_id": item["id"],
                "name": item["name"],
                "color": item["color"],
                "count": item["count"],
            }
            for item in by_tag
        ]

        data = {
            "total": total,
            "by_status": by_status,
            "by_priority": by_priority,
            "by_tag": by_tag,
        }
        serializer = StatisticsSerializer(data)
        return Response(serializer.data)
```

注意：需要在文件顶部追加 `from django.db.models import Count, Q`。

- [ ] **Step 2: 在 `backend/api/urls.py` 注册路由**

在现有的 `router.register("tasks", ...)` 之后追加：

```python
router.register("statistics", StatisticsViewSet, basename="api-statistics")
```

同时在顶部的 import 区域追加：
```python
from .api import StatisticsViewSet
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/api.py backend/api/urls.py
git commit -m "feat: 新增统计 API 端点 GET /api/statistics/"
```

---

### Task 3: 后端测试

**Files:**
- Create: `backend/api/tests/test_statistics.py`

- [ ] **Step 1: 创建测试文件 `backend/api/tests/test_statistics.py`**

```python
import pytest
from django.utils.text import slugify
from rest_framework.test import APIClient

from api.models import BoardColumn, Tag, Task


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def regular_user(db, django_user_model):
    user = django_user_model.objects.create_user(
        username="testuser", password="testpass123"
    )
    return user


@pytest.fixture
def user_factory(db, django_user_model):
    def create(username):
        return django_user_model.objects.create_user(
            username=username, password="testpass123"
        )

    return create


def _create_column(user, name, slug=None, position=0):
    return BoardColumn.objects.create(
        name=name,
        slug=slug or slugify(name),
        position=position,
        created_by=user,
    )


def _create_task(user, title, status="todo", priority="medium", tags=None):
    task = Task.objects.create(
        title=title,
        status=status,
        priority=priority,
        created_by=user,
    )
    if tags:
        task.tags.set(tags)
    return task


@pytest.mark.django_db
def test_statistics_empty(api_client, regular_user):
    """无任务时返回 total=0 和空列表"""
    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200
    assert resp.data["total"] == 0
    assert resp.data["by_status"] == []
    assert resp.data["by_priority"] == []
    assert resp.data["by_tag"] == []


@pytest.mark.django_db
def test_statistics_by_status(api_client, regular_user):
    """按状态正确分组计数"""
    _create_column(regular_user, "待办", "todo", 0)
    _create_column(regular_user, "已完成", "done", 2)
    _create_task(regular_user, "T1", status="todo")
    _create_task(regular_user, "T2", status="todo")
    _create_task(regular_user, "T3", status="done")

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200
    assert resp.data["total"] == 3

    status_map = {item["status"]: item for item in resp.data["by_status"]}
    assert status_map["todo"]["count"] == 2
    assert status_map["todo"]["label"] == "待办"
    assert status_map["done"]["count"] == 1
    assert status_map["done"]["label"] == "已完成"


@pytest.mark.django_db
def test_statistics_by_priority(api_client, regular_user):
    """按优先级正确分组计数"""
    _create_task(regular_user, "T1", priority="high")
    _create_task(regular_user, "T2", priority="high")
    _create_task(regular_user, "T3", priority="low")

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200

    priority_map = {item["priority"]: item for item in resp.data["by_priority"]}
    assert priority_map["high"]["count"] == 2
    assert priority_map["low"]["count"] == 1


@pytest.mark.django_db
def test_statistics_by_tag(api_client, regular_user):
    """按标签正确分组计数"""
    tag1 = Tag.objects.create(name="工作", color="#6366f1", created_by=regular_user)
    tag2 = Tag.objects.create(name="学习", color="#f59e0b", created_by=regular_user)
    _create_task(regular_user, "T1", tags=[tag1])
    _create_task(regular_user, "T2", tags=[tag1])
    _create_task(regular_user, "T3", tags=[tag2])
    _create_task(regular_user, "T4")  # 无标签

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200

    tag_map = {item["name"]: item for item in resp.data["by_tag"]}
    assert tag_map["工作"]["count"] == 2
    assert tag_map["工作"]["color"] == "#6366f1"
    assert tag_map["学习"]["count"] == 1
    # 无标签的任务不计入 by_tag


@pytest.mark.django_db
def test_statistics_excludes_deleted(api_client, regular_user):
    """已软删除的任务不计入统计"""
    _create_task(regular_user, "T1", status="todo")
    task = _create_task(regular_user, "T2", status="done")
    task.is_deleted = True
    task.save()

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200
    assert resp.data["total"] == 1
    assert len(resp.data["by_status"]) == 1
    assert resp.data["by_status"][0]["status"] == "todo"


@pytest.mark.django_db
def test_statistics_user_isolation(api_client, regular_user, user_factory):
    """不同用户数据完全隔离"""
    other = user_factory("other")
    _create_column(other, "Other Column", "todo", 0)
    _create_task(other, "Other Task", status="todo")

    _create_task(regular_user, "My Task", status="todo")

    api_client.force_authenticate(regular_user)
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 200
    assert resp.data["total"] == 1
    # status label 来自 regular_user 自己的 BoardColumn，而非 other 的
    status_map = {item["status"]: item for item in resp.data["by_status"]}
    assert status_map["todo"]["label"] == "todo"  # 没有对应列时回退到 slug


@pytest.mark.django_db
def test_statistics_unauthenticated(api_client):
    """未认证请求返回 401"""
    resp = api_client.get("/api/statistics/", format="json")
    assert resp.status_code == 401
```

- [ ] **Step 2: 运行测试确认全部通过**

Run: `docker compose exec api uv run -- pytest api/tests/test_statistics.py -v`
Expected: 7 passed

- [ ] **Step 3: Commit**

```bash
git add backend/api/tests/test_statistics.py
git commit -m "test: 新增统计 API 测试（7 个用例）"
```

---

### Task 4: 前端 openapi:generate

**Files:**
- 自动生成: `frontend/packages/types/api/` 下文件

- [ ] **Step 1: 运行 openapi:generate 更新前端 API 类型**

Run: `docker compose exec web pnpm openapi:generate`
Expected: 成功生成，包含 `statistics` 相关类型和 API client 方法

- [ ] **Step 2: 验证生成的类型中包含 statistics 相关方法**

在 `frontend/packages/types/api/` 中搜索 "statistics" 确认存在对应的 client 方法（如 `statisticsList`）。

- [ ] **Step 3: Commit**

```bash
git add frontend/packages/types/
git commit -m "chore: openapi:generate 更新前端统计 API 类型"
```

---

### Task 5: 前端 i18n + 侧边栏

**Files:**
- Modify: `frontend/packages/ui/locales/zh-CN.json`
- Modify: `frontend/packages/ui/locales/en.json`
- Modify: `frontend/apps/web/components/sidebar.tsx`

- [ ] **Step 1: 在 `zh-CN.json` 的 `sidebar` 对象中追加 `"statistics"` key**

在 `sidebar` 对象的 `"logoutConfirm"` 行后面追加：
```json
"statistics": "统计"
```

同时在 `zh-CN.json` 顶层追加 `statistics` 命名空间（与 `kanban`、`tags` 同级）：
```json
"statistics": {
  "title": "数据统计",
  "statusDistribution": "状态分布",
  "priorityDistribution": "优先级分布",
  "tagDistribution": "标签分布",
  "statusCount": "状态数量",
  "emptyTitle": "暂无任务数据",
  "emptyDescription": "创建任务后将自动生成统计图表",
  "goToKanban": "前往看板",
  "total": "总计",
  "count": "数量"
}
```

- [ ] **Step 2: 在 `en.json` 做同样的操作**

sidebar 追加：
```json
"statistics": "Statistics"
```

顶层追加：
```json
"statistics": {
  "title": "Statistics",
  "statusDistribution": "Status Distribution",
  "priorityDistribution": "Priority Distribution",
  "tagDistribution": "Tag Distribution",
  "statusCount": "Status Count",
  "emptyTitle": "No task data yet",
  "emptyDescription": "Statistics will be generated after you create tasks",
  "goToKanban": "Go to Kanban",
  "total": "Total",
  "count": "Count"
}
```

- [ ] **Step 3: 在 `sidebar.tsx` 的 `NAV_ITEMS` 数组中追加统计项**

在 `trash` 项之后追加：
```typescript
{ key: 'statistics', href: '/statistics', icon: '📊' },
```

- [ ] **Step 4: Commit**

```bash
git add frontend/packages/ui/locales/ frontend/apps/web/components/sidebar.tsx
git commit -m "feat: 新增统计页 i18n 和侧边栏导航入口"
```

---

### Task 6: 前端 Server Action

**Files:**
- Create: `frontend/apps/web/actions/statistics-actions.ts`

- [ ] **Step 1: 创建 `frontend/apps/web/actions/statistics-actions.ts`**

```typescript
'use server'

import { getApiClient } from '@/lib/api'
import { authOptions } from '@/lib/auth'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

export async function getStatistics() {
  const session = await getServerSession(authOptions)

  try {
    const apiClient = await getApiClient(session)
    const response = await apiClient.statistics.statisticsList()
    return { success: true, data: response }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message }
    }
    return { success: false, message: '获取统计数据失败' }
  }
}
```

注意：`apiClient.statistics.statisticsList()` 的具体方法名取决于 openapi:generate 的输出，如果不同请按实际生成的方法名调整。

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/actions/statistics-actions.ts
git commit -m "feat: 新增 getStatistics server action"
```

---

### Task 7: 前端图表组件

**Files:**
- Create: `frontend/apps/web/components/statistics/status-donut-chart.tsx`
- Create: `frontend/apps/web/components/statistics/priority-donut-chart.tsx`
- Create: `frontend/apps/web/components/statistics/tag-bar-chart.tsx`
- Create: `frontend/apps/web/components/statistics/status-bar-chart.tsx`

- [ ] **Step 1: 创建 `frontend/apps/web/components/statistics/status-donut-chart.tsx`**

```tsx
'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

interface StatusItem {
  status: string
  label: string
  count: number
}

interface StatusDonutChartProps {
  data: StatusItem[]
  total: number
}

export function StatusDonutChart({ data, total }: StatusDonutChartProps) {
  const chartData = data.map((item) => ({
    name: item.label,
    value: item.count,
  }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center text-sm text-gray-500">
        总计 {total}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `frontend/apps/web/components/statistics/priority-donut-chart.tsx`**

```tsx
'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
}

interface PriorityItem {
  priority: string
  label: string
  count: number
}

interface PriorityDonutChartProps {
  data: PriorityItem[]
  total: number
}

export function PriorityDonutChart({ data, total }: PriorityDonutChartProps) {
  const chartData = data.map((item) => ({
    name: item.label,
    value: item.count,
    priority: item.priority,
  }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.priority] || '#9ca3af'} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center text-sm text-gray-500">
        总计 {total}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 `frontend/apps/web/components/statistics/tag-bar-chart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface TagItem {
  tag_id: string
  name: string
  color: string
  count: number
}

interface TagBarChartProps {
  data: TagItem[]
}

export function TagBarChart({ data }: TagBarChartProps) {
  const chartData = data.map((item) => ({
    name: item.name,
    count: item.count,
    color: item.color,
  }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: 创建 `frontend/apps/web/components/statistics/status-bar-chart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

interface StatusItem {
  status: string
  label: string
  count: number
}

interface StatusBarChartProps {
  data: StatusItem[]
}

export function StatusBarChart({ data }: StatusBarChartProps) {
  const chartData = data.map((item) => ({
    name: item.label,
    count: item.count,
  }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 5: 安装 recharts 依赖**

Run: `docker compose exec web pnpm --filter web add recharts`

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/web/components/statistics/ frontend/apps/web/package.json frontend/pnpm-lock.yaml
git commit -m "feat: 新增 4 个统计图表组件（环形图 + 柱状图）"
```

---

### Task 8: 前端统计页面

**Files:**
- Create: `frontend/apps/web/components/statistics/stats-empty-state.tsx`
- Create: `frontend/apps/web/components/statistics/stats-page-client.tsx`
- Create: `frontend/apps/web/app/(dashboard)/statistics/page.tsx`

- [ ] **Step 1: 创建 `frontend/apps/web/components/statistics/stats-empty-state.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function StatsEmptyState() {
  const t = useTranslations('statistics')

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 text-5xl">📊</div>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('emptyTitle')}</h2>
      <p className="mb-6 text-sm text-gray-500">{t('emptyDescription')}</p>
      <Link
        href="/"
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
      >
        {t('goToKanban')}
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `frontend/apps/web/components/statistics/stats-page-client.tsx`**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { StatusDonutChart } from './status-donut-chart'
import { PriorityDonutChart } from './priority-donut-chart'
import { TagBarChart } from './tag-bar-chart'
import { StatusBarChart } from './status-bar-chart'
import { StatsEmptyState } from './stats-empty-state'

interface StatusItem {
  status: string
  label: string
  count: number
}

interface PriorityItem {
  priority: string
  label: string
  count: number
}

interface TagItem {
  tag_id: string
  name: string
  color: string
  count: number
}

interface StatsData {
  total: number
  by_status: StatusItem[]
  by_priority: PriorityItem[]
  by_tag: TagItem[]
}

interface StatsPageClientProps {
  data: StatsData
}

export function StatsPageClient({ data }: StatsPageClientProps) {
  const t = useTranslations('statistics')

  if (data.total === 0) {
    return <StatsEmptyState />
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t('title')}</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 状态分布环形图 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('statusDistribution')}</h2>
          <StatusDonutChart data={data.by_status} total={data.total} />
        </div>

        {/* 优先级分布环形图 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('priorityDistribution')}</h2>
          <PriorityDonutChart data={data.by_priority} total={data.total} />
        </div>

        {/* 标签分布横向柱状图 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('tagDistribution')}</h2>
          {data.by_tag.length > 0 ? (
            <TagBarChart data={data.by_tag} />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
              暂无标签数据
            </div>
          )}
        </div>

        {/* 状态数量横向柱状图 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-700">{t('statusCount')}</h2>
          <StatusBarChart data={data.by_status} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 `frontend/apps/web/app/(dashboard)/statistics/page.tsx`**

```typescript
import { getStatistics } from '@/actions/statistics-actions'
import { StatsPageClient } from '@/components/statistics/stats-page-client'

export default async function StatisticsPage() {
  const result = await getStatistics()
  const data = result.success
    ? (result.data as any)
    : { total: 0, by_status: [], by_priority: [], by_tag: [] }

  return <StatsPageClient data={data} />
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/web/app/ frontend/apps/web/components/statistics/stats-empty-state.tsx frontend/apps/web/components/statistics/stats-page-client.tsx
git commit -m "feat: 新增统计页面（空状态 + 2×2 网格布局）"
```

---

### Task 9: 端到端验证

- [ ] **Step 1: 启动服务，验证侧边栏显示「统计」入口**

Run: `docker compose up`
Expected: 侧边栏出现「统计」或「📊」图标

- [ ] **Step 2: 点击进入统计页，验证空状态显示**

新建用户无任务时，应显示"暂无任务数据"提示和"前往看板"按钮。

- [ ] **Step 3: 创建几个任务后验证图表正常渲染**

在看板创建不同状态、优先级、标签的任务后，返回统计页验证 4 个图表数据正确。

- [ ] **Step 4: 运行全部后端测试确认无回归**

Run: `docker compose exec api uv run -- pytest . -v`
Expected: 全部通过

- [ ] **Step 5: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: 端到端验证修复"
```

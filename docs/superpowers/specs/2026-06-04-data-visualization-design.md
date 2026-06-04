# 数据可视化设计文档

> 日期：2026-06-04
> 阶段：第三期
> 前置依赖：第二期（自定义列、跨优先级拖拽）全部完成

---

## 一、功能概述

在任务看板基础上，新增**个人数据统计页**，以 2×2 网格布局展示 4 个图表，帮助用户快速了解任务分布情况。

**不做**：附件上传、评论、站内通知、管理端应用（管理端作为独立项目后续规划）。

---

## 二、图表清单

| 图表 | 类型 | 数据源 | 说明 |
|------|------|--------|------|
| 状态分布 | 环形图（Donut） | `by_status` | 按看板列分组计数，中心显示任务总数 |
| 优先级分布 | 环形图（Donut） | `by_priority` | 按高/中/低分组计数，中心显示任务总数 |
| 标签分布 | 横向柱状图 | `by_tag` | 按标签分组计数，柱子用标签自身的 color 着色 |
| 状态数量 | 横向柱状图 | `by_status` | 每根柱子对应一个看板列，直观对比数量差异 |

---

## 三、后端 API

### 3.1 端点

`GET /api/statistics/` — 返回当前用户的任务统计聚合数据

### 3.2 响应结构

```json
{
  "total": 42,
  "by_status": [
    {"status": "todo", "label": "待办", "count": 15},
    {"status": "in_progress", "label": "进行中", "count": 10},
    {"status": "done", "label": "已完成", "count": 17}
  ],
  "by_priority": [
    {"priority": "high", "label": "高", "count": 8},
    {"priority": "medium", "label": "中", "count": 20},
    {"priority": "low", "label": "低", "count": 14}
  ],
  "by_tag": [
    {"tag_id": "uuid", "name": "工作", "color": "#6366f1", "count": 12},
    {"tag_id": "uuid", "name": "学习", "color": "#f59e0b", "count": 8}
  ]
}
```

- `total`：当前用户未删除任务总数
- `by_status.label`：从 `BoardColumn` 表获取（匹配 slug 到 name）
- `by_priority.label`：使用 Task 模型的 `get_priority_display()`
- `by_tag`：通过 M2M 关联 `TaskTag` 聚合，`color` 取自 Tag 模型

### 3.3 实现方式

- 新建 `StatisticsViewSet`，仅 `list` action
- 所有查询统一带 `created_by=request.user` 和 `is_deleted=False` 条件，确保数据隔离
- `by_status`：先查 `BoardColumn.objects.filter(created_by=user)` 获取列定义，再按 status 分组计数，用 slug 匹配 label
- `by_priority`：固定 high/medium/low 三值，用 `values('priority').annotate(count=Count('id'))` 聚合
- `by_tag`：通过 `Tag.objects.filter(created_by=user)` 关联 `tasks` 反向查询，统计每个标签的任务数（排除已删除任务）
- 使用 `drf-spectacular` 装饰器生成 OpenAPI schema，前端执行 `openapi:generate` 后自动获得类型定义

### 3.4 Serializer

```python
class StatisticsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    by_status = StatusCountSerializer(many=True)
    by_priority = PriorityCountSerializer(many=True)
    by_tag = TagCountSerializer(many=True)
```

嵌套 serializer 用于 schema 生成，实际数据在 ViewSet 中用 ORM 聚合构建。

---

## 四、前端设计

### 4.1 技术选型

- **图表库**：Recharts（`recharts` npm 包）
- **安装位置**：`frontend/apps/web/`

### 4.2 文件结构

```
frontend/apps/web/
├── app/(dashboard)/statistics/
│   └── page.tsx                        # Server Component，调用 getStatistics()
├── actions/
│   └── statistics-actions.ts           # Server Action，调用生成的 API client
├── components/statistics/
│   ├── stats-page-client.tsx           # 客户端主组件，2×2 网格布局 + 空状态判断
│   ├── status-donut-chart.tsx          # 状态分布环形图（PieChart + Pie innerRadius）
│   ├── priority-donut-chart.tsx        # 优先级分布环形图
│   ├── tag-bar-chart.tsx              # 标签分布横向柱状图（BarChart layout="vertical"）
│   ├── status-bar-chart.tsx           # 状态数量横向柱状图
│   └── stats-empty-state.tsx          # 空状态提示组件
```

### 4.3 数据流

1. `page.tsx`（Server Component）调用 `getStatistics()` server action
2. `getStatistics()` 通过生成的 API client 调用 `GET /api/statistics/`
3. 数据以 props 传入 `StatsPageClient`
4. 当 `total === 0` 时渲染 `StatsEmptyState`，否则渲染 4 个图表组件
5. 各图表组件接收各自的 `by_*` 数据独立渲染

### 4.4 图表组件详情

**环形图（状态/优先级）**：
- 使用 `<PieChart>` + `<Pie innerRadius={60} outerRadius={80}>`
- 中心用 Recharts `<text>` 元素显示任务总数
- 配色方案：使用 Recharts `COLORS` 调色板（如 `['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']`），状态和优先级按索引依次取色
- 优先级固定色：高=#ef4444（红）、中=#f59e0b（黄）、低=#10b981（绿）
- 右侧显示图例（label + count）

**横向柱状图（标签/状态）**：
- 使用 `<BarChart layout="vertical">`
- 标签分布：每根柱子用标签自身的 `color` 字段着色
- 状态分布：使用与状态环形图相同的 `COLORS` 调色板按索引取色
- X 轴显示数量，Y 轴显示名称

### 4.5 响应式布局

- 桌面端：`grid grid-cols-1 md:grid-cols-2 gap-6`，2×2 网格
- 移动端：自动折叠为单列

### 4.6 空状态

当 `total === 0` 时，不渲染图表，显示居中提示：
- 图标：`BarChart3`（lucide-react）
- 文案：「暂无任务数据，创建任务后将自动生成统计图表」
- 引导按钮：跳转到看板页

### 4.7 导航入口

在 `sidebar.tsx` 的导航列表中，"回收站"下方新增「统计」项：
- 路由：`/statistics`
- 图标：`BarChart3`（lucide-react）
- i18n key：`sidebar.statistics`

### 4.8 i18n

在 `zh-CN.json` / `en.json` 新增 `statistics` 命名空间：

```json
{
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
}
```

---

## 五、页面清单

| 页面 | 类型 | 路由 | 说明 |
|------|------|------|------|
| 数据统计页 | 新增 | `/statistics` | 2×2 网格展示 4 个图表 |

---

## 六、验收标准

- [ ] 侧边栏显示「统计」导航入口
- [ ] 点击进入统计页，展示 2×2 网格布局
- [ ] 状态分布环形图正确展示各列任务数量，中心显示总数
- [ ] 优先级分布环形图正确展示高/中/低任务数量
- [ ] 标签分布横向柱状图正确展示各标签任务数，柱子颜色与标签颜色一致
- [ ] 状态数量横向柱状图正确展示各列任务数
- [ ] 无任务时显示空状态提示，不渲染图表
- [ ] 桌面端 2×2 网格，移动端自动折叠为单列
- [ ] 所有查询严格按 `created_by=request.user` 过滤，不会出现串数据
- [ ] 自定义列改名后，统计页 label 同步更新
- [ ] `openapi:generate` 执行后前端类型自动更新

# 第二期技术设计文档 — 任务看板

> 版本：1.0
> 日期：2026-06-02
> 前置依赖：第一期（i18n、邮箱注册、RBAC）已完成

---

## 一、设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 看板类型 | 泳道看板（可切换维度） | 同时关注流程阶段和分类维度 |
| 视觉风格 | Clean & Professional | 白底细边框、微阴影、克制精致 |
| 任务编辑交互 | 模态弹窗 | 不离开看板视图，简单直接 |
| 导航结构 | 左侧侧边栏 | 适合后续功能扩展 |
| 拖拽库 | @dnd-kit/core | 灵活、支持复杂拖放场景 |
| 架构方案 | 客户端分组 + 乐观更新 | 拖拽零延迟，后端只做 CRUD |

---

## 二、数据模型

### 2.1 Task 模型

```
Task
├── id            UUID, PK
├── title         CharField(200), 必填
├── description   TextField, 可空
├── status        CharField(20), choices: todo / in_progress / done
├── priority      CharField(10), choices: high / medium / low
├── due_date      DateField, 可空
├── created_by    FK(User), on_delete=CASCADE
├── is_deleted    BooleanField, default=False
├── deleted_at    DateTimeField, 可空
├── created_at    DateTimeField, auto_now_add
├── modified_at   DateTimeField, auto_now
└── tags           M2M → Tag, through TaskTag
```

**索引**：
- `(created_by, status, is_deleted)` — 看板列表查询
- `(created_by, is_deleted, deleted_at)` — 回收站查询
- `(is_deleted, deleted_at)` — 自动清理查询

**约束**：
- 查询时默认过滤 `is_deleted=False`（通过自定义 Manager）
- 管理员可查看所有用户任务（复用 IsOwnerOrAdmin 权限）

### 2.2 Tag 模型

```
Tag
├── id            UUID, PK
├── name          CharField(50), 必填
├── color         CharField(7), 预设颜色值（如 #EF4444）
├── created_by    FK(User), on_delete=CASCADE
├── created_at    DateTimeField, auto_now_add
└── modified_at   DateTimeField, auto_now
```

**约束**：
- 同一用户下标签名称唯一（unique_together: `created_by + name`）
- 标签仅对创建者可见

### 2.3 预设颜色

提供给用户选择的标签颜色列表：

| 名称 | 色值 | 用途示例 |
|------|------|----------|
| Red | #EF4444 | bug / 紧急 |
| Orange | #F97316 | 优化 |
| Amber | #F59E0B | 警告 |
| Green | #22C55E | feature / 完成 |
| Blue | #3B82F6 | 设计 |
| Indigo | #6366F1 | 后端 |
| Purple | #A855F7 | 前端 |
| Pink | #EC4899 | 文档 |
| Gray | #6B7280 | 其他 |

---

## 三、API 设计

### 3.1 任务 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/tasks/` | 任务列表（支持筛选） | IsOwnerOrAdmin |
| POST | `/api/tasks/` | 创建任务 | IsAuthenticated |
| GET | `/api/tasks/{id}/` | 任务详情 | IsOwnerOrAdmin |
| PUT | `/api/tasks/{id}/` | 全量更新 | IsOwnerOrAdmin |
| PATCH | `/api/tasks/{id}/` | 部分更新（拖拽改状态） | IsOwnerOrAdmin |
| DELETE | `/api/tasks/{id}/` | 软删除（设 is_deleted=True） | IsOwnerOrAdmin |
| POST | `/api/tasks/{id}/restore/` | 从回收站恢复 | IsOwnerOrAdmin |
| DELETE | `/api/tasks/{id}/permanent/` | 永久删除 | IsOwnerOrAdmin |
| GET | `/api/tasks/trash/` | 回收站列表 | IsAuthenticated |

**GET /api/tasks/ 查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 按状态筛选：todo / in_progress / done |
| priority | string | 按优先级筛选：high / medium / low |
| tag | UUID | 按标签筛选 |
| search | string | 搜索标题和描述 |
| page | int | 页码（默认分页） |

**GET /api/tasks/trash/ 查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 |
| ordering | string | 排序（默认 -deleted_at） |

**请求/响应示例**：

创建任务 `POST /api/tasks/`：
```json
// Request
{
  "title": "设计首页原型",
  "description": "完成首页的线框图设计",
  "priority": "high",
  "due_date": "2026-06-10",
  "tags": ["uuid-1", "uuid-2"]
}

// Response 201
{
  "id": "uuid",
  "title": "设计首页原型",
  "description": "完成首页的线框图设计",
  "status": "todo",
  "priority": "high",
  "due_date": "2026-06-10",
  "tags": [
    {"id": "uuid-1", "name": "feature", "color": "#22C55E"},
    {"id": "uuid-2", "name": "设计", "color": "#3B82F6"}
  ],
  "created_by": "username",
  "created_at": "2026-06-02T10:00:00Z",
  "modified_at": "2026-06-02T10:00:00Z"
}
```

拖拽改状态 `PATCH /api/tasks/{id}/`：
```json
// Request
{
  "status": "in_progress"
}

// Response 200（同上结构）
```

### 3.2 标签 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/tags/` | 当前用户的标签列表 | IsAuthenticated |
| POST | `/api/tags/` | 创建标签 | IsAuthenticated |
| PUT | `/api/tags/{id}/` | 更新标签 | IsOwnerOrAdmin |
| DELETE | `/api/tags/{id}/` | 删除标签（解除任务关联） | IsOwnerOrAdmin |

**标签请求/响应**：
```json
// POST /api/tags/
{"name": "bug", "color": "#EF4444"}
// Response 201
{"id": "uuid", "name": "bug", "color": "#EF4444"}
```

### 3.3 自动清理

通过 Django 管理命令实现 30 天自动清理：

```bash
# 手动执行
docker compose exec api uv run -- python manage.py cleanup_expired_tasks

# 生产环境通过 cron 或 celery beat 定时执行
```

命令逻辑：删除 `is_deleted=True` 且 `deleted_at < now() - 30天` 的任务。

---

## 四、前端架构

### 4.1 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 看板主页 | 泳道看板视图 |
| `/tags` | 标签管理 | 创建/编辑/删除标签 |
| `/trash` | 回收站 | 已删除任务列表 |

### 4.2 组件层级

```
app/layout.tsx                  # 根布局（AuthProvider, NextIntlClientProvider）
├── components/
│   ├── sidebar.tsx             # 左侧导航栏
│   │   ├── SidebarNav          # 导航菜单（看板/标签/回收站）
│   │   ├── SidebarUserInfo     # 底部用户信息 + 退出
│   │   └── SidebarAdminLink    # 管理员入口（仅 isStaff 可见）
│   ├── kanban/
│   │   ├── kanban-board.tsx    # 看板主组件（列 + 泳道分组）
│   │   ├── kanban-column.tsx   # 单列（todo/in_progress/done）
│   │   ├── kanban-row.tsx      # 泳道行（按维度分组）
│   │   ├── task-card.tsx       # 任务卡片（拖拽单元）
│   │   ├── task-modal.tsx      # 任务创建/编辑弹窗
│   │   ├── swimlane-toggle.tsx # 泳道维度切换器
│   │   └── kanban-filters.tsx  # 筛选栏（搜索、优先级等）
│   ├── tags/
│   │   ├── tag-list.tsx        # 标签列表
│   │   ├── tag-form.tsx        # 标签创建/编辑表单
│   │   └── color-picker.tsx    # 颜色选择器
│   └── trash/
│       └── trash-list.tsx      # 回收站列表
├── actions/
│   ├── task-actions.ts         # 任务 CRUD Server Actions
│   └── tag-actions.ts          # 标签 CRUD Server Actions
└── lib/
    ├── validation.ts           # Zod schemas（task, tag）
    └── kanban-utils.ts         # 泳道分组逻辑
```

### 4.3 泳道实现

泳道分组纯前端实现，后端只返回扁平任务列表：

```typescript
// kanban-utils.ts 核心逻辑
type SwimlaneDimension = 'none' | 'tag' | 'priority'

function groupTasksByDimension(
  tasks: Task[],
  dimension: SwimlaneDimension,
  allTags: Tag[]
): SwimlaneGroup[] {
  if (dimension === 'none') {
    return [{ key: 'all', label: '', tasks }]
  }

  if (dimension === 'priority') {
    return [
      { key: 'high', label: '高优先级', tasks: tasks.filter(t => t.priority === 'high') },
      { key: 'medium', label: '中优先级', tasks: tasks.filter(t => t.priority === 'medium') },
      { key: 'low', label: '低优先级', tasks: tasks.filter(t => t.priority === 'low') },
    ]
  }

  if (dimension === 'tag') {
    // 按标签分组，无标签归入「未分类」
    const groups = allTags.map(tag => ({
      key: tag.id,
      label: tag.name,
      color: tag.color,
      tasks: tasks.filter(t => t.tags.some(tg => tg.id === tag.id)),
    }))
    const untagged = tasks.filter(t => t.tags.length === 0)
    if (untagged.length > 0) {
      groups.push({ key: 'untagged', label: '未分类', tasks: untagged })
    }
    return groups
  }
}
```

### 4.4 拖拽实现

使用 @dnd-kit/core + @dnd-kit/sortable：

```
数据流：
1. 用户拖起卡片 → dnd-kit 捕获 dragStart 事件
2. 卡片移到新列 → 立即更新本地状态（乐观更新）
3. 松手 → 调用 Server Action PATCH /api/tasks/{id}/
4. 成功 → 保持本地状态
5. 失败 → 回滚到原位置 + 显示 toast 错误提示
```

关键 dnd-kit 配置：
- `DndContext` 包裹整个看板
- 每个 `KanbanColumn` 是一个 `Droppable` 容器
- 每个 `TaskCard` 是一个 `Draggable` 单元
- 自定义 `collisionDetection` 使用 `closestCorners` 算法
- 使用 `KeyboardSensor` + `PointerSensor` 支持键盘操作

### 4.5 侧边栏布局

```
┌──────────┬──────────────────────────────────────┐
│  Sidebar │  Main Content                        │
│          │                                      │
│ ◆ 看板   │  [泳道切换: 无 | 标签 | 优先级]      │
│ ◇ 标签   │                                      │
│ ◇ 回收站 │  待办      │ 进行中    │ 已完成       │
│          │ ──────────┼──────────┼──────────     │
│          │ [card]    │ [card]   │               │
│          │ [card]    │          │ [card]        │
│          │           │          │               │
│ ──────── │                                      │
│ 👤 用户  │                                      │
│ 退出登录 │                                      │
└──────────┴──────────────────────────────────────┘
```

侧边栏宽度：固定 240px，深色或浅灰色背景。
主内容区：flex-1 填充剩余空间。

---

## 五、后端实现

### 5.1 自定义 Manager

```python
class TaskManager(models.Manager):
    def active(self):
        """返回未删除的任务"""
        return self.filter(is_deleted=False)

    def deleted(self):
        """返回已删除的任务（回收站）"""
        return self.filter(is_deleted=True)
```

Task 模型设置 `objects = TaskManager()`，确保默认查询排除已删除任务。

### 5.2 ViewSet 结构

```
TaskViewSet
├── list        GET    /api/tasks/          # active().filter(用户权限)
├── create      POST   /api/tasks/          # 自动填 created_by
├── retrieve    GET    /api/tasks/{id}/
├── update      PUT    /api/tasks/{id}/
├── partial_update PATCH /api/tasks/{id}/   # 拖拽改状态用这个
├── destroy     DELETE /api/tasks/{id}/     # 软删除
├── restore     POST   /api/tasks/{id}/restore/
├── permanent_destroy DELETE /api/tasks/{id}/permanent/
└── trash       GET    /api/tasks/trash/    # 自定义 action
```

### 5.3 Serializer 设计

- `TaskListSerializer`：列表页用，包含标签摘要
- `TaskDetailSerializer`：详情/编辑用，包含完整标签信息
- `TaskCreateSerializer`：创建用，校验标题、标签归属
- `TagSerializer`：标签 CRUD

### 5.4 权限

复用 `IsOwnerOrAdmin`：
- `created_by` 字段自动设置为当前用户
- 普通用户只能操作自己的任务
- 管理员可查看所有用户的任务

### 5.5 清理命令

```python
# management/commands/cleanup_expired_tasks.py
class Command(BaseCommand):
    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)
        result = Task.objects.filter(is_deleted=True, deleted_at__lt=cutoff).delete()
        self.stdout.write(f"已清理 {result[0]} 条过期任务")
```

---

## 六、前端交互细节

### 6.1 看板主页

- 页面加载时获取所有任务 + 所有标签，存入 React 状态
- 泳道切换器在顶部，三选项：无 / 按标签 / 按优先级
- 筛选栏支持：搜索框（标题+描述）、优先级下拉
- 列标题显示任务数量
- 空列显示「+ 添加任务」占位

### 6.2 任务卡片

卡片显示内容：
- 标题（单行截断）
- 标签（色点 + 文字，最多显示 3 个）
- 优先级标识（色条或色点）
- 截止日期（过期显示红色）
- 拖拽手柄（hover 时显示）

### 6.3 任务弹窗

弹窗字段：
- 标题（必填，文本输入）
- 描述（选填，多行文本）
- 优先级（单选：高/中/低）
- 截止日期（日期选择器）
- 标签（多选下拉，从用户标签中选择）
- 状态（下拉切换：待办/进行中/已完成）

### 6.4 标签管理页

- 卡片网格布局展示所有标签
- 每个标签卡片显示：颜色预览、名称、关联任务数
- 点击卡片进入编辑模式
- 顶部「+ 新建标签」按钮
- 删除标签时确认：提示将解除与所有任务的关联

### 6.5 回收站页

- 表格布局：标题、原状态、删除时间、操作
- 操作列：恢复、永久删除
- 顶部显示回收站任务总数
- 永久删除需要二次确认

---

## 七、文件变更清单

### 后端新建文件

| 文件 | 职责 |
|------|------|
| `backend/api/models.py` | 新增 Task、Tag 模型（追加到现有文件） |
| `backend/api/serializers.py` | 新增 Task/Tag 相关 Serializer |
| `backend/api/api.py` | 新增 TaskViewSet、TagViewSet |
| `backend/api/urls.py` | 注册新路由 |
| `backend/api/permissions.py` | 复用 IsOwnerOrAdmin |
| `backend/api/managers.py` | TaskManager 自定义 Manager |
| `backend/api/management/commands/cleanup_expired_tasks.py` | 自动清理命令 |
| `backend/api/tests/test_tasks.py` | 任务相关测试 |
| `backend/api/tests/test_tags.py` | 标签相关测试 |

### 前端新建文件

| 文件 | 职责 |
|------|------|
| `frontend/apps/web/components/sidebar.tsx` | 左侧导航栏 |
| `frontend/apps/web/components/kanban/kanban-board.tsx` | 看板主组件 |
| `frontend/apps/web/components/kanban/kanban-column.tsx` | 看板列 |
| `frontend/apps/web/components/kanban/kanban-row.tsx` | 泳道行 |
| `frontend/apps/web/components/kanban/task-card.tsx` | 任务卡片 |
| `frontend/apps/web/components/kanban/task-modal.tsx` | 任务弹窗 |
| `frontend/apps/web/components/kanban/swimlane-toggle.tsx` | 泳道切换器 |
| `frontend/apps/web/components/kanban/kanban-filters.tsx` | 筛选栏 |
| `frontend/apps/web/components/tags/tag-list.tsx` | 标签列表 |
| `frontend/apps/web/components/tags/tag-form.tsx` | 标签表单 |
| `frontend/apps/web/components/tags/color-picker.tsx` | 颜色选择器 |
| `frontend/apps/web/components/trash/trash-list.tsx` | 回收站列表 |
| `frontend/apps/web/actions/task-actions.ts` | 任务 Server Actions |
| `frontend/apps/web/actions/tag-actions.ts` | 标签 Server Actions |
| `frontend/apps/web/lib/kanban-utils.ts` | 泳道分组工具函数 |
| `frontend/apps/web/app/(dashboard)/layout.tsx` | 带侧边栏的布局 |
| `frontend/apps/web/app/(dashboard)/page.tsx` | 看板主页 |
| `frontend/apps/web/app/(dashboard)/tags/page.tsx` | 标签管理页 |
| `frontend/apps/web/app/(dashboard)/trash/page.tsx` | 回收站页 |

### 前端修改文件

| 文件 | 改动 |
|------|------|
| `frontend/apps/web/app/layout.tsx` | 移除顶部语言切换和导航（移到侧边栏） |
| `frontend/apps/web/lib/validation.ts` | 新增 task/tag 的 Zod schemas |
| `frontend/packages/ui/locales/en.json` | 新增看板/标签/回收站翻译 |
| `frontend/packages/ui/locales/zh-CN.json` | 同上 |
| `frontend/apps/web/package.json` | 添加 @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |

---

## 八、自检

| 检查项 | 状态 |
|--------|------|
| 无 TBD/TODO 占位符 | ✅ |
| 需求文档验收标准全覆盖 | ✅ 2.1 任务 CRUD、2.2 标签、2.3 回收站 |
| API 端点与数据模型一致 | ✅ |
| 前端组件与交互设计匹配 | ✅ |
| i18n 翻译已规划 | ✅ |
| 权限模型与第一期 RBAC 一致 | ✅ IsOwnerOrAdmin |
| 无 Placeholder | ✅ |

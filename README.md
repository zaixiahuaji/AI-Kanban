# AI Kanban — AI 看板任务管理系统

> 基于 [unfoldadmin/turbo](https://github.com/unfoldadmin/turbo)（Django + Next.js 全栈脚手架）二次开发的 AI 看板任务管理系统。

## 🚀 快速开始

### 环境要求

- Docker & Docker Compose
- （可选）Node.js 18+、Python 3.12+、pnpm 用于本地开发

### 配置

```bash
# 克隆项目
git clone https://github.com/zaixiahuaji/AI-Kanban.git
cd AI-Kanban

# 配置环境变量
cp .env.backend.template .env.backend
cp .env.frontend.template .env.frontend
```

编辑 `.env.backend`，设置 `SECRET_KEY`，开发时加 `DEBUG=1`。

编辑 `.env.frontend`，设置 `NEXTAUTH_SECRET`：

```bash
openssl rand -base64 32
```

如果需要 AI 助手功能，在 `.env.backend` 中配置 AI 服务（兼容 OpenAI API 的服务均可接入）：

```
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

> 内置每日调用次数限制，默认关闭。如需启用，设置 `AI_DAILY_LIMIT_ENABLED=true` 和 `AI_DAILY_LIMIT=50`。

### 启动

```bash
docker compose up
```

启动后访问：
- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- Swagger 文档：http://localhost:8000/api/schema/swagger-ui/

### 创建管理员

```bash
docker compose exec api uv run -- python manage.py migrate
docker compose exec api uv run -- python manage.py createsuperuser
```

## ✨ 功能特性

### 看板管理

- **拖拽操作** — 基于 `@dnd-kit`，支持任务在列间拖拽移动、列顺序拖拽重排
- **自定义列** — 创建、重命名、删除列，自由定义工作流阶段
- **泳道视图** — 支持按标签 / 按优先级分组展示，也可关闭泳道平铺显示
- **筛选搜索** — 按标题搜索、按优先级筛选
- **任务属性** — 标题、描述、优先级（高/中/低）、截止日期、标签、所属列
- **乐观更新** — 拖拽即时生效，失败自动回滚

### AI 助手

- **自然语言操控看板** — 对话式创建/移动/删除任务，无需手动操作
- **21 个工具** — 涵盖任务 CRUD、列管理、标签管理、批量操作
- **安全分级** — 只读工具自动执行；写操作静默执行；删除类操作需二次确认
- **操作可撤销** — 所有操作支持一键撤回，包括批量删除、列重命名等
- **流式响应** — 基于 SSE 的实时流式输出，逐字显示
- **语音输入** — 集成 Web Speech API，说话即可下达指令
- **可配额限制** — 内置每日调用次数限制，默认关闭，可按需开启

### 标签系统

- **彩色标签** — 9 种预设颜色，网格布局展示
- **行内编辑** — 点击编辑直接在原位替换为表单
- **关联管理** — 删除标签自动解除与所有任务的关联

### 回收站

- **软删除** — 任务删除后进入回收站，可恢复
- **永久删除** — 确认后从数据库彻底移除

### 统计面板

- **四维度图表** — 状态分布环形图、优先级分布环形图、标签分布柱状图、列任务数柱状图
- **空状态** — 无任务时引导用户前往看板

### 管理后台

- **仪表盘** — 用户总数、任务总数、完成率、活跃用户、趋势图
- **用户管理** — 搜索、启用/禁用、删除（级联软删除其任务）
- **任务管理** — 搜索、按状态/优先级筛选、删除
- **系统监控** — 数据库健康检查、错误日志自动采集、自动清理

### 其他

- **国际化** — 中英文双语切换，基于 `next-intl`
- **邮箱验证** — 注册时发送验证码，6 位数字 + 60 秒冷却
- **JWT 认证** — Access/Refresh Token 自动续期
- **OpenAPI 类型安全** — 后端 schema 自动生成前端 TypeScript 类型

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| **后端框架** | Django 5 + Django REST Framework |
| **认证** | SimpleJWT（后端）+ NextAuth（前端）|
| **API 文档** | drf-spectacular（Swagger UI）|
| **管理后台** | Django Unfold |
| **AI 引擎** | 兼容 OpenAI API 的 LLM 服务 |
| **前端框架** | Next.js 16（App Router）|
| **UI 组件** | Tailwind CSS + shadcn/ui |
| **表单** | react-hook-form + zod |
| **拖拽** | @dnd-kit |
| **图表** | Recharts |
| **国际化** | next-intl |
| **包管理** | pnpm workspace |
| **数据库** | PostgreSQL |
| **容器化** | Docker Compose |
| **代码规范** | Ruff（Python）+ Biome（JS/TS）|

## 📁 项目结构

```
├── backend/                  # Django 后端
│   └── api/
│       ├── models.py         # 数据模型（User, Task, Tag, BoardColumn, ChatMessage, AIAction, ...）
│       ├── api.py            # ViewSet 业务逻辑
│       ├── ai_tools.py       # AI 工具定义、handler、撤销逻辑（21 个工具）
│       ├── ai_views.py       # AI 聊天 API（SSE 流式响应）
│       ├── serializers.py    # DRF 序列化器
│       └── tests/            # pytest 测试
├── frontend/                 # pnpm workspace
│   ├── apps/
│   │   └── web/              # Next.js 应用
│   │       ├── app/          # App Router 页面
│   │       ├── components/   # 组件（kanban, ai, tags, trash, statistics, forms）
│   │       ├── actions/      # Server Actions
│   │       └── lib/          # 工具函数（auth, api, ai-sse, kanban-utils）
│   └── packages/
│       ├── types/            # 自动生成的 API 客户端（不可手动编辑）
│       └── ui/               # 共享 UI 组件（表单、图表、样式、国际化）
├── docker-compose.yaml
└── CLAUDE.md                 # AI 辅助开发指南
```

## 🚢 生产部署

使用 `docker-compose.prod.yaml` 部署到服务器，与本地开发配置完全独立。

### 配置

```bash
# 复制生产环境变量模板
cp .env.backend.prod.template .env.backend.prod
cp .env.frontend.prod.template .env.frontend.prod
```

编辑 `.env.backend.prod`：

- `SECRET_KEY` — 设置固定密钥（`openssl rand -hex 32` 生成）
- `ALLOWED_HOSTS` — 填入服务器公网 IP，如 `123.45.67.89,api`
- 删除 `DEBUG=1`（留空即关闭调试模式）

编辑 `.env.frontend.prod`：

- `NEXTAUTH_URL` — 改为 `http://你的公网IP:3000/api/auth`
- `NEXTAUTH_SECRET` — 设置随机密钥（`openssl rand -base64 32` 生成）
- `NEXT_PUBLIC_API_URL` — 改为 `http://你的公网IP:8000`

### 启动

```bash
docker compose -f docker-compose.prod.yaml up -d
```

启动后访问：

- 前端：`http://你的公网IP:3000`
- 管理后台：`http://你的公网IP:3001`
- 后端 API：`http://你的公网IP:8000`

### 创建管理员

```bash
docker compose -f docker-compose.prod.yaml exec api uv run -- python manage.py createsuperuser
```

> 生产环境使用 Gunicorn 作为 WSGI 服务器，前端使用 `next start` 生产模式运行，服务崩溃自动重启。

## 🔧 开发指南

### 常用命令

```bash
# 后端
docker compose exec api uv run -- python manage.py migrate          # 数据库迁移
docker compose exec api uv run -- pytest .                          # 运行全部测试
docker compose exec api uv run -- pytest -k "test_name"             # 运行单个测试
docker compose exec api uv add <package>                            # 添加 Python 依赖

# 前端
docker compose exec web pnpm --filter web add <package>             # 添加前端依赖
docker compose exec web pnpm openapi:generate                       # 重新生成 API 类型
```

### 本地开发（不用 Docker）

后端：

```bash
cd backend && uv sync && uv run -- python manage.py runserver
```

前端：

```bash
cd frontend && pnpm install && pnpm --filter web dev
```

> 本地前端需将 `.env.frontend` 中 `API_URL` 改为 `http://localhost:8000`。

### API 类型生成流程

后端修改 API 后，前端类型需要同步更新：

1. 后端开发完成（Serializer / ViewSet 变更）
2. 运行 `docker compose exec web pnpm openapi:generate`
3. `frontend/packages/types/api/` 自动更新
4. 前端使用生成的类型和客户端方法

## 🏗 架构概要

### 数据流

```
Client 组件（react-hook-form + zod 验证）
  → Server Action（服务端调用）
    → 生成的 API Client（@frontend/types）
      → Django REST API
        → PostgreSQL
```

### 认证流程

前端使用 NextAuth CredentialsProvider，登录时调用 Django `/api/token/` 获取 JWT Access/Refresh Token。Access Token 过期后在 NextAuth `jwt` callback 中使用 Refresh Token 自动续期。

### AI 工具架构

```
用户消息
  → Django API（SSE 流式响应）
    → LLM API（function calling，兼容 OpenAI 协议）
      → 工具安全分级判断（safe / auto / confirm）
        → 执行 handler + 记录 AIAction
          → 返回结果 + 撤销信息
```

- **safe**：只读工具，直接执行
- **auto**：非破坏性写操作，静默执行
- **confirm**：删除类操作，前端展示确认按钮，用户确认后执行
- 所有操作记录到 `AIAction` 表，支持通过 `undo` 端点一键撤回

## 📄 License

本项目基于原始 [Turbo](https://github.com/unfoldadmin/turbo) 项目开发，原项目遵循其原有许可证。

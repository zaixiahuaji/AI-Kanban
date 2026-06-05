# 第4期：登录/注册页 UI 重设计 设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将登录、注册、账户管理页面的 UI 风格统一到首页（dashboard）的极简灰调设计语言。

**Architecture:** 修改 `(auth)` 和 `(account)` 路由组的 layout + 表单组件，将现有的紫色硬编码样式替换为首页一致的 Tailwind 类。新增侧边栏账户管理导航入口。使用 frontend-design skill 实现高质量的视觉细节。

**Tech Stack:** Next.js 16 App Router, Tailwind CSS, react-hook-form, zod, next-intl

---

## 1. 设计语言（与首页统一）

| 元素 | 当前样式 | 改造后 |
|------|---------|--------|
| 页面背景 | `#fff`（白底） | `bg-gray-50`（`#F9FAFB`） |
| 卡片 | 无卡片，裸露表单 | `rounded-xl border border-gray-200 bg-white shadow-sm` |
| 主按钮 | `bg-purple-600` | `bg-gray-900 hover:bg-gray-800` |
| 输入框 focus | `focus:ring-purple-300` | `focus:border-blue-300 focus:ring-1 focus:ring-blue-300` |
| 标题 | `text-xl font-medium text-gray-700` + `<hr>` | `text-xl font-semibold text-gray-900`（无分隔线） |
| 错误状态 | `outline-red-700 focus:ring-red-300` | `border-red-500 text-red-600` |
| 链接 | `text-gray-700 underline decoration-gray-400` | `text-gray-900 font-medium`（无下划线） |
| 品牌 Logo | 无 | `bg-gray-900` 圆角方块 + 白色字母 |

### 首页样式参考（必须匹配）

这些值从现有 dashboard 组件中提取，改造后的 auth 页面必须使用完全相同的 Tailwind 类：

```
卡片容器:   rounded-xl border border-gray-200 bg-white p-4 shadow-sm
模态框:     rounded-xl bg-white p-6 shadow-xl
标题:       text-lg font-semibold text-gray-900
副标题:     text-sm text-gray-500
表单标签:   text-sm font-medium text-gray-700 mb-1 block
输入框:     w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300
主按钮:     rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800
次按钮:     rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50
错误提示:   rounded-lg bg-red-50 p-3 text-sm text-red-600
```

---

## 2. 改造范围

### 2.1 重设计页面

| 页面 | 路由 | 改动 |
|------|------|------|
| 登录 | `/login` | layout + LoginForm 组件样式 |
| 注册 | `/register` | layout + RegisterForm 组件样式 |
| 个人资料 | `/profile` | layout + ProfileForm 组件样式 |
| 修改密码 | `/change-password` | layout + ChangePasswordForm 组件样式 |
| 删除账户 | `/delete-account` | layout + DeleteAccountForm 组件样式 |

### 2.2 新增导航入口

侧边栏中，在主导航区和底部用户区域之间插入账户导航组，样式与主导航项一致：
- "个人资料" 链接 → `/profile`，图标 lucide-react `User`
- "修改密码" 链接 → `/change-password`，图标 lucide-react `KeyRound`
- 个人资料页内提供"删除账户"入口 → `/delete-account`

---

## 3. 文件修改清单

### 3.1 布局修改

**`frontend/apps/web/app/(auth)/layout.tsx`**
- 背景：`bg-gray-50`
- 卡片：包裹 `<div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">`
- 居中：`min-h-screen flex items-center justify-center`

**`frontend/apps/web/app/(account)/layout.tsx`**
- 同上样式
- **保留现有的 `getServerSession` + redirect 认证守卫逻辑**，只修改外层 JSX 的 className

### 3.2 共享表单组件修改（`frontend/packages/ui/forms/`）

**`form-header.tsx`**
- 移除 `<hr>` 分隔线
- 标题改为 `text-xl font-semibold text-gray-900`
- 描述改为 `text-sm text-gray-500`

**`form-footer.tsx`**
- 链接改为 `text-gray-900 font-medium`，移除下划线

**`submit-field.tsx`**
- 按钮改为 `rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800`
- loading 状态改为 `bg-gray-700`

**`text-field.tsx`**
- 输入框改为 `w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300`
- 错误状态改为 `border-red-500 focus:border-red-500 focus:ring-red-200`
- 标签改为 `text-sm font-medium text-gray-700`

### 3.3 侧边栏修改

**`frontend/apps/web/components/sidebar.tsx`**
- 底部用户区域新增"个人资料"和"修改密码"两个导航项
- 图标使用 lucide-react 的 `User` 和 `KeyRound`

### 3.4 注册页特有组件

**`frontend/apps/web/components/forms/register-form.tsx`**
- "发送验证码"按钮改为次按钮样式（`border border-gray-200 hover:bg-gray-50`）
- 发送成功/失败提示使用统一的成功/错误样式

---

## 4. 不改动的部分

- 表单逻辑（react-hook-form、zod 验证、API 调用）不变
- Server Actions 不变
- i18n key 不变（文案不变）
- 路由结构不变

---

## 5. 实现注意事项

1. **使用 frontend-design skill**：表单组件的视觉细节（间距、过渡动画、hover 效果）由 frontend-design skill 驱动实现，确保高质量
2. **响应式**：卡片在移动端应有合适的 padding 和 max-width
3. **过渡动画**：按钮和输入框添加 `transition-colors`
4. **暗色模式**：本次暂不处理暗色模式，统一使用硬编码 Tailwind 类（与 dashboard 现有方式一致）。未来如需暗色模式，需要同步改造所有页面
5. **品牌元素**：登录/注册页卡片顶部新增居中 Logo，新建组件：`w-10 h-10 rounded-lg bg-gray-900 text-white font-bold text-lg flex items-center justify-center`，显示字母 "T"。侧边栏 Logo 也同步更新为相同视觉元素
6. **共享组件影响范围**：`form-header.tsx`、`form-footer.tsx`、`submit-field.tsx`、`text-field.tsx` 仅被 auth 和 account 页面使用，不影响 dashboard 页面（dashboard 使用独立的模态框表单组件）。实施前需验证无其他消费者

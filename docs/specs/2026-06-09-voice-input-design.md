# AI 聊天语音输入功能设计

**目标：** 在 AI 聊天输入框中添加语音转文字输入功能，使用浏览器原生 Web Speech API。

**架构：** 纯前端实现。新建 `useSpeechRecognition` 自定义 Hook 封装 Web Speech API，在 `AIInput` 组件中集成麦克风按钮和实时转写。

**技术栈：** Web Speech API（`SpeechRecognition`）、React Hook、lucide-react 图标

---

## 需求确认

| 项目 | 决定 |
|------|------|
| 实现方式 | 浏览器原生 Web Speech API |
| 交互模式 | 点击切换（点一下开始，再点一下停止） |
| 按钮位置 | 输入框左侧独立按钮 |
| 语言 | 跟随系统语言 |
| 录音反馈 | 实时转写到输入框 + 按钮脉冲动画 |

## 涉及文件

| 文件 | 操作 | 职责 |
|------|------|------|
| `components/ai/ai-input.tsx` | 修改 | 添加麦克风按钮，集成语音识别 |
| `lib/use-speech-recognition.ts` | 新建 | 封装 Web Speech API 的自定义 Hook |

## 核心 Hook：useSpeechRecognition

### 状态

- `isListening: boolean` — 是否正在录音
- `transcript: string` — 当前识别文字（实时更新）
- `isSupported: boolean` — 浏览器是否支持

### 方法

- `start()` — 开始语音识别
- `stop()` — 停止语音识别
- `toggle()` — 切换录音状态

### 回调参数

- `onInterimResult(text: string)` — 实时中间结果，用于更新输入框
- `onFinalResult(text: string)` — 最终识别结果

### 实现要点

- 使用 `webkitSpeechRecognition`（Chrome/Edge）或 `SpeechRecognition`（标准 API）
- 设置 `interimResults = true` 启用实时结果
- 设置 `continuous = false`（点击模式下不需要连续识别）
- 语言参数不设置，跟随浏览器默认
- Hook 内部管理 SpeechRecognition 实例的生命周期
- 组件卸载时自动停止录音并清理
- 浏览器不支持时 `isSupported` 返回 `false`

## UI 行为

### AIInput 组件改动

**布局变化：**
```
之前：[  输入框                    ➤ ]
之后：[🎤] [  输入框                ➤ ]
```

**麦克风按钮状态：**
- 默认：灰色 `Mic` 图标
- 录音中：红色脉冲动画 + `Mic` 图标，按钮变为 `bg-red-50 border-red-300`
- 不支持：隐藏按钮

**输入框状态：**
- 录音中 placeholder 变为 "正在聆听..."
- 实时转写文字显示在输入框中（作为 value）
- 停止后用户可编辑识别结果，手动点击发送

### 交互流程

1. 用户点击麦克风 → `toggle()` → 开始录音
2. 录音中 `onInterimResult` 持续更新输入框文字
3. 用户再次点击麦克风 → `toggle()` → 停止录音
4. `onFinalResult` 将最终文字填入输入框
5. 用户手动编辑或直接点发送

## 降级策略

- `SpeechRecognition` 不存在时：隐藏麦克风按钮，不影响正常文字输入
- 录音出错（如无麦克风权限）时：Toast 提示错误信息，自动恢复到未录音状态
- 不支持自动结束识别超时处理：监听 `onend` 事件，如果意外结束且用户未主动停止，重置状态

## 不做的事

- 不做语音合成（TTS）
- 不做录音文件保存
- 不做后端改动
- 不做语言手动切换 UI
- 不做离线语音识别回退

# yuan-agent

> A lightweight Agent chat workspace built with Vue 3, Vite, Pinia, TypeScript and Express.

`yuan-agent` 是一个面向大模型对话与 Agent 场景的 Web 端演示项目，聚焦以下核心能力：

- 流式响应与多轮上下文管理
- RAG 检索增强与引用来源展示
- Function Calling 风格工具调用链路
- 语音输入与长会话性能优化

项目适合作为以下场景的参考实现：

- AI 对话产品原型
- Agent 工作台 / Copilot 类前端
- RAG + Tool Calling 的交互链路演示
- Vue 端大模型应用工程化实践

## Features

### Streaming Chat

- 基于 `fetch + ReadableStream + TextDecoder` 解析 SSE 数据流
- 支持逐 token 输出与生成中状态提示
- 支持手动中断回答生成

### Conversation Management

- 基于 Pinia 管理当前会话、消息列表与 UI 状态
- 支持新建、切换、删除会话
- 会话数据保存在本地，刷新后仍可恢复

### RAG Knowledge Base

- 支持上传 `.md`、`.markdown`、`.txt`、`.json` 文件
- 服务端自动执行文本分块、Embedding 建索引与相似度召回
- 前端展示引用来源、片段内容与相关度，增强回答可解释性

### Tool Calling

- 基于 Function Calling 风格抽象工具调用协议
- 已打通「模型决策 → 参数解析 → 工具执行 → 结果回填」链路
- 前端可视化展示工具调用参数、执行状态与结果

### Voice Input

- 基于 Web Speech API 封装语音输入能力
- 提供 `idle / recording / processing` 三态状态管理
- 识别结果自动回填到输入框

### Performance

- 使用 `defineAsyncComponent` 延迟加载核心对话面板
- 使用 `vue-virtual-scroller` 优化长会话列表渲染性能
- 在高频消息更新场景下减少不必要的 DOM 压力

## Tech Stack

### Frontend

- `Vue 3`
- `Vite`
- `Pinia`
- `TypeScript`
- `vue-virtual-scroller`
- `MarkdownIt`
- `DOMPurify`

### Backend

- `Express`
- `Multer`
- `dotenv`
- `Qwen Compatible API`

## Built-in Tools

当前内置以下工具：

- `retrieve_knowledge`：从知识库召回相关内容
- `list_knowledge_documents`：查看当前已导入文档
- `get_current_time`：获取当前系统时间

## Project Structure

```text
.
├── server/                 # Express 服务、Qwen 接口、RAG 与工具调用逻辑
├── src/
│   ├── components/         # 页面与业务组件
│   ├── composables/        # 组合式 Hooks
│   ├── services/           # 接口请求、Markdown 渲染等服务层
│   ├── stores/             # Pinia 状态管理
│   ├── types/              # 类型定义
│   ├── App.vue             # 应用入口组件
│   ├── main.ts             # 前端入口
│   └── styles.css          # 全局样式
├── .env.example            # 环境变量示例
├── package.json
└── README.md
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

填写以下变量：

| Name | Description | Default |
| --- | --- | --- |
| `QWEN_API_KEY` | DashScope / Qwen API Key | - |
| `QWEN_BASE_URL` | Qwen compatible endpoint | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `QWEN_MODEL` | Chat model name | `qwen-plus` |
| `QWEN_EMBEDDING_MODEL` | Embedding model name | `text-embedding-v3` |
| `SERVER_PORT` | Local server port | `8787` |

### 3. Start development server

```bash
npm run dev
```

默认启动后：

- Frontend: `http://localhost:5173/`
- Backend: `http://127.0.0.1:8787/`

### 4. Build for production

```bash
npm run build
```

## How It Works

### Streaming Response Flow

1. 前端向 `/api/chat/stream` 发起请求
2. 服务端调用 Qwen 对话接口
3. 前端持续读取 SSE 数据流并解析 token
4. UI 实时拼接并渲染生成内容

### RAG Flow

1. 用户上传知识文件
2. 服务端执行文本分块
3. 调用 Embedding 模型生成向量
4. 模型在回答过程中按需调用 `retrieve_knowledge`
5. 服务端返回召回结果与引用信息
6. 前端展示引用来源、片段和相关度

### Tool Calling Flow

1. 模型决定是否触发工具调用
2. 服务端解析 `tool_calls`
3. 执行对应工具逻辑
4. 通过 SSE 回传工具状态与结果
5. 前端展示调用参数、执行状态与返回内容

## Notes

- 语音识别依赖浏览器对 `SpeechRecognition` 或 `webkitSpeechRecognition` 的支持
- 当前知识库使用服务端内存存储，服务重启后数据会清空
- 若无法访问 Qwen 服务，请优先检查 API Key、网络环境、代理与账户配额
- 当前后端使用 OpenAI Compatible 格式接入 Qwen 接口

## Roadmap

- 接入持久化向量数据库
- 补充更多工具类型与工具失败态处理
- 增加会话云端同步能力
- 支持更完整的权限控制与多用户协作

## Development Status

当前仓库适合作为功能演示与工程实践参考项目；若用于生产环境，建议继续补充：

- 持久化存储
- 鉴权与权限控制
- 日志与监控
- 更完善的错误恢复与重试机制
- 自动化测试与 CI 流程

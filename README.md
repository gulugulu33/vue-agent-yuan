# yuan-agent

一个面向大模型对话与 Agent 场景的 Web 端演示项目，基于 `Vue 3 + Vite + Pinia + TypeScript + Express` 构建，支持流式响应、多轮上下文管理、RAG 检索增强、工具调用可视化、语音输入以及长会话虚拟列表渲染。

## 项目亮点

- **流式响应**：基于 `fetch + ReadableStream + TextDecoder` 解析 SSE 数据流，实现逐 token 输出
- **多轮上下文管理**：使用 Pinia 管理会话、消息、当前会话切换与本地持久化
- **RAG 检索增强**：支持知识文件上传、文本分块、Embedding 建索引、相似度召回与引用来源展示
- **Agent 工具调用**：打通「模型决策 → 参数解析 → 工具执行 → 结果回填」链路，并在界面中展示调用状态
- **语音输入**：基于 Web Speech API 封装 `idle / recording / processing` 三态语音输入能力
- **性能优化**：使用 `defineAsyncComponent` 懒加载核心会话面板，引入 `vue-virtual-scroller` 优化长列表渲染
- **Markdown 渲染**：支持基础 Markdown 展示，并通过 `DOMPurify` 做安全清洗

## 技术栈

### 前端

- `Vue 3`
- `Vite`
- `Pinia`
- `TypeScript`
- `vue-virtual-scroller`
- `MarkdownIt`
- `DOMPurify`

### 后端

- `Express`
- `Multer`
- `dotenv`
- `Qwen Compatible API`

## 功能概览

### 1. 智能对话

- 支持多轮上下文连续对话
- 支持中断生成
- 支持会话创建、切换、删除与本地缓存

### 2. RAG 知识库

- 支持上传 `.md`、`.markdown`、`.txt`、`.json` 文件
- 后端自动进行文本分块与向量化
- 基于相似度召回知识片段
- 前端展示引用来源、片段内容与相关度

### 3. Agent 工具调用

当前内置工具：

- `retrieve_knowledge`：检索知识库相关内容
- `list_knowledge_documents`：列出当前知识文档
- `get_current_time`：获取当前系统时间

### 4. 语音输入

- 浏览器支持时可直接语音输入
- 识别结果自动写入输入框
- 对浏览器不支持、权限异常、识别失败等场景有状态反馈

## 目录结构

```text
.
├── server/                 # Express 服务与 Qwen / RAG / 工具调用逻辑
├── src/
│   ├── components/         # UI 组件
│   ├── composables/        # 组合式 Hooks
│   ├── services/           # 接口、流式、Markdown 等服务
│   ├── stores/             # Pinia 状态管理
│   ├── types/              # 类型定义
│   ├── App.vue             # 应用入口组件
│   ├── main.ts             # 前端入口
│   └── styles.css          # 全局样式
├── .env.example            # 环境变量示例
├── package.json
└── README.md
```

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

然后填写你的配置：

```bash
QWEN_API_KEY=your_api_key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
QWEN_EMBEDDING_MODEL=text-embedding-v3
SERVER_PORT=8787
```

### 3. 启动开发环境

```bash
npm run dev
```

启动后：

- 前端默认地址：`http://localhost:5173/`
- 后端默认地址：`http://127.0.0.1:8787/`

### 4. 生产构建

```bash
npm run build
```

## 交互链路说明

### 对话流式输出

1. 前端发送消息到 `/api/chat/stream`
2. 后端调用 Qwen 对话接口
3. 前端持续读取 SSE 数据流并逐步拼接消息内容
4. 界面实时渲染生成中的回答

### RAG 检索流程

1. 用户上传知识文件
2. 后端对文本进行分块
3. 调用 Embedding 模型生成向量
4. 用户提问时，模型可调用 `retrieve_knowledge`
5. 后端执行相似度检索并返回引用片段
6. 前端展示引用来源与内容

### 工具调用流程

1. 模型根据问题决定是否发起工具调用
2. 后端解析 `tool_calls`
3. 执行本地工具逻辑
4. 将执行结果与状态通过 SSE 回传前端
5. 前端展示执行中 / 成功状态及结果内容

## 注意事项

- 语音识别依赖浏览器是否支持 `SpeechRecognition` 或 `webkitSpeechRecognition`
- 知识库当前为服务端内存存储，重启服务后会丢失
- 若无法访问 Qwen 服务，请检查 API Key、网络、代理或账户配额
- 当前后端通过 OpenAI 兼容格式接入 Qwen 接口

## 后续可扩展方向

- 接入持久化向量数据库
- 增加更多工具类型与权限控制
- 增加更完整的工具失败态与重试机制
- 增加用户体系与会话云端同步

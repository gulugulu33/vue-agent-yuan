import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '4mb' }));

const state = {
  documents: [],
  chunks: []
};

const config = {
  apiKey: process.env.QWEN_API_KEY,
  baseUrl: (process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, ''),
  model: process.env.QWEN_MODEL || 'qwen-plus',
  embeddingModel: process.env.QWEN_EMBEDDING_MODEL || 'text-embedding-v3',
  port: Number(process.env.SERVER_PORT || 8787)
};

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createAppError(code, message, details = '', status = 500) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.status = status;
  return error;
}

function getErrorPayload(error, fallbackMessage) {
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || fallbackMessage,
      details: error.details || '',
      status: error.status || 500
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: fallbackMessage,
    details: '',
    status: 500
  };
}

function tokenize(input) {
  return input
    .toLowerCase()
    .replace(/[`*_>#\-\[\]\(\)]/g, ' ')
    .split(/[\s，。；：！？、,.!?;:\/\\|]+/)
    .filter((token) => token.length > 1);
}

function chunkText(text, chunkSize = 900, overlap = 160) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const value = text.slice(start, end).trim();
    if (value) chunks.push(value);
    start += chunkSize - overlap;
  }
  return chunks;
}

function cosineSimilarity(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function qwenFetch(endpoint, body, stream = false) {
  if (!config.apiKey) {
    throw createAppError('MISSING_API_KEY', '缺少 Qwen API Key', '请检查服务端 `.env.local` 中的 `QWEN_API_KEY` 配置。', 500);
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw createAppError(
      'NETWORK_UNREACHABLE',
      '无法连接到 Qwen 服务',
      '当前运行环境访问 DashScope 失败。请检查网络、代理、VPN 或防火墙设置。',
      502
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) {
      throw createAppError('INVALID_API_KEY', 'Qwen API Key 无效或已过期', text || '请检查 `QWEN_API_KEY` 是否正确。', 401);
    }

    if (response.status === 429) {
      throw createAppError('RATE_LIMITED', 'Qwen 请求过于频繁', text || '请稍后重试，或检查账户配额是否充足。', 429);
    }

    throw createAppError('QWEN_HTTP_ERROR', `Qwen 请求失败（${response.status}）`, text || '上游模型服务返回异常响应。', 502);
  }

  if (stream) {
    return response;
  }

  return response.json();
}

async function createEmbedding(text) {
  const result = await qwenFetch('/embeddings', {
    model: config.embeddingModel,
    input: text.slice(0, 6000)
  });

  const vector = result.data?.[0]?.embedding;
  if (!vector) {
    throw createAppError('EMBEDDING_EMPTY', 'Embedding 生成失败', '模型返回为空，无法建立向量索引。', 502);
  }

  return vector;
}

function buildCitation(chunk, score) {
  return {
    id: chunk.id,
    title: chunk.documentName,
    snippet: chunk.text,
    source: `向量知识库 / ${chunk.documentName}`,
    score: Number(score.toFixed(4))
  };
}

async function searchKnowledge(query, topK = 4) {
  if (!state.chunks.length) {
    return [];
  }

  const queryEmbedding = await createEmbedding(query);
  return state.chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .filter((item) => item.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => buildCitation(chunk, score));
}

async function ingestDocuments(files) {
  const supported = files.filter((file) => /\.(txt|md|markdown|json)$/i.test(file.originalname));

  if (!supported.length) {
    throw createAppError('UNSUPPORTED_FILES', '没有可导入的知识文件', '仅支持 `.md`、`.markdown`、`.txt`、`.json` 文件。', 400);
  }

  const inserted = [];
  const nextDocuments = [];
  const nextChunks = [];

  for (const file of supported) {
    const content = file.buffer.toString('utf-8').trim();
    if (!content) continue;

    const document = {
      id: uid('doc'),
      name: file.originalname,
      content,
      createdAt: Date.now()
    };

    nextDocuments.push(document);
    inserted.push(document);

    const parts = chunkText(content);
    for (const part of parts) {
      const embedding = await createEmbedding(part);
      nextChunks.push({
        id: uid('chunk'),
        documentId: document.id,
        documentName: document.name,
        text: part,
        tokens: tokenize(part),
        embedding
      });
    }
  }

  if (!inserted.length) {
    throw createAppError('EMPTY_FILES', '上传的文件内容为空', '请确认文件不是空文件，且编码为 UTF-8。', 400);
  }

  state.documents.push(...nextDocuments);
  state.chunks.push(...nextChunks);

  return inserted;
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function createToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'retrieve_knowledge',
        description: '从后端向量知识库检索与用户问题最相关的文档片段',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '需要检索的查询内容' },
            topK: { type: 'integer', description: '返回结果数量，默认 4' }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_knowledge_documents',
        description: '列出当前后端知识库中的文档',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_current_time',
        description: '获取当前系统时间',
        parameters: { type: 'object', properties: {} }
      }
    }
  ];
}

async function executeToolCall(toolCall) {
  const name = toolCall.function?.name || 'unknown';
  const args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};

  if (name === 'retrieve_knowledge') {
    const citations = await searchKnowledge(String(args.query || ''), Number(args.topK || 4));
    return {
      result: { citations, count: citations.length },
      citations
    };
  }

  if (name === 'list_knowledge_documents') {
    return {
      result: {
        documents: state.documents.map((doc) => ({ id: doc.id, name: doc.name, createdAt: doc.createdAt }))
      },
      citations: []
    };
  }

  if (name === 'get_current_time') {
    return {
      result: {
        iso: new Date().toISOString(),
        locale: new Date().toLocaleString('zh-CN', { hour12: false })
      },
      citations: []
    };
  }

  return {
    result: { error: '未知工具' },
    citations: []
  };
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true, documents: state.documents.length, chunks: state.chunks.length });
});

app.get('/api/knowledge', (_, res) => {
  res.json({
    documents: state.documents.map((doc) => ({ id: doc.id, name: doc.name, createdAt: doc.createdAt }))
  });
});

app.post('/api/knowledge/upload', upload.array('files'), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const inserted = await ingestDocuments(files);
    res.json({
      documents: inserted.map((doc) => ({ id: doc.id, name: doc.name, createdAt: doc.createdAt })),
      message: `已成功导入 ${inserted.length} 份知识文件。`
    });
  } catch (error) {
    const payload = getErrorPayload(error, '知识库导入失败');
    res.status(payload.status).json({
      error: payload.message,
      code: payload.code,
      details: payload.details
    });
  }
});

app.delete('/api/knowledge/:id', (req, res) => {
  const { id } = req.params;
  state.documents = state.documents.filter((doc) => doc.id !== id);
  state.chunks = state.chunks.filter((chunk) => chunk.documentId !== id);
  res.json({ ok: true });
});

app.delete('/api/knowledge', (_, res) => {
  state.documents = [];
  state.chunks = [];
  res.json({ ok: true });
});

app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const tools = createToolDefinitions();
    const messages = [
      {
        role: 'system',
        content: [
          '你是一个中文 Agent 助手。',
          '你可以使用函数工具来检索知识库、查看文档列表、获取当前时间。',
          '当用户的问题依赖知识库内容时，优先调用 retrieve_knowledge。',
          '最终回答需要清晰、结构化、简洁。'
        ].join('\n')
      },
      ...incomingMessages
    ];

    const gatheredCitations = [];
    const gatheredTools = [];

    for (let round = 0; round < 4; round += 1) {
      const completion = await qwenFetch('/chat/completions', {
        model: config.model,
        stream: false,
        temperature: 0.4,
        messages,
        tools,
        tool_choice: 'auto'
      });

      const choice = completion.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls || [];

      if (!toolCalls.length) {
        if (choice) {
          messages.push(choice);
        }
        break;
      }

      messages.push({
        role: 'assistant',
        content: choice.content || '',
        tool_calls: toolCalls
      });

      for (const toolCall of toolCalls) {
        const args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
        sendSse(res, 'tool', {
          id: toolCall.id,
          name: toolCall.function?.name,
          args,
          status: 'running'
        });

        const executed = await executeToolCall(toolCall);
        gatheredCitations.push(...executed.citations);
        gatheredTools.push({
          id: toolCall.id,
          name: toolCall.function?.name,
          args,
          status: 'success',
          result: JSON.stringify(executed.result, null, 2)
        });

        sendSse(res, 'tool', {
          id: toolCall.id,
          name: toolCall.function?.name,
          args,
          status: 'success',
          result: executed.result
        });

        if (executed.citations.length) {
          sendSse(res, 'citations', { citations: executed.citations });
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(executed.result)
        });
      }
    }

    const streamResponse = await qwenFetch('/chat/completions', {
      model: config.model,
      stream: true,
      temperature: 0.4,
      messages
    }, true);

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const lines = event.split('\n').map((line) => line.trim()).filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') {
            sendSse(res, 'done', { citations: gatheredCitations, tools: gatheredTools });
            res.end();
            return;
          }

          try {
            const json = JSON.parse(raw);
            const token = json.choices?.[0]?.delta?.content;
            if (token) {
              sendSse(res, 'token', { token });
            }
          } catch {
            // ignore invalid chunks
          }
        }
      }
    }

    sendSse(res, 'done', { citations: gatheredCitations, tools: gatheredTools });
    res.end();
  } catch (error) {
    const payload = getErrorPayload(error, '服务异常');
    sendSse(res, 'error', {
      code: payload.code,
      message: payload.message,
      details: payload.details
    });
    res.end();
  }
});

app.use(express.static(path.resolve(__dirname, '../dist')));
app.get('*', (_, res) => {
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${config.port}`);
});

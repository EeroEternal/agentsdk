# AgentSDK

统一封装多个 AI 编程助手能力的 SDK（Cursor、Windsurf、Vercel、Replit 等）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 CURSOR_API_KEY
```

获取 Cursor API Key: https://cursor.com/dashboard/integrations

### 3. 运行示例

```bash
# 编译 TypeScript
npm run build

# 运行 Cursor Clone 示例（交互式对话）
npm run example:cursor-clone
```

## 使用示例

### 基础用法：创建 Agent 并发送提示

```typescript
import { createSDK, ProviderConfig } from "agentsdk";

const config: ProviderConfig = {
  type: "cursor",
  apiKey: process.env.CURSOR_API_KEY!,
};

async function main() {
  // 1. 创建 SDK 实例
  const sdk = createSDK(config);
  
  // 2. 列出可用模型
  const models = await sdk.listModels();
  console.log("可用模型:", models);
  
  // 3. 创建 Agent (本地模式)
  const agent = await sdk.createAgent({
    apiKey: config.apiKey,
    model: { id: "composer-2" },
    workingDirectory: process.cwd(),
  });
  
  // 4. 发送提示并流式接收响应
  const run = await agent.send("解释这个代码仓库的功能", {
    onDelta: ({ text, type }) => {
      if (type === "text-delta") {
        process.stdout.write(text);
      }
    },
  });
  
  // 5. 等待完成
  const result = await run.wait();
  console.log("\n完成:", result.status);
  
  // 6. 清理
  await agent.close();
}

main().catch(console.error);
```

### 高级用法：云端 Agent

```typescript
const agent = await sdk.createAgent({
  apiKey: config.apiKey,
  model: { id: "composer-2" },
  cloudConfig: {
    repos: [{ url: "https://github.com/your-org/your-repo" }],
    autoCreatePR: true,
    envType: "cloud",
  },
});
```

### 恢复已有 Agent

```typescript
const agent = await sdk.resumeAgent("agent-id-here", {
  apiKey: config.apiKey,
});
```

## API 文档

### IAgentSDK

| 方法 | 描述 |
|------|------|
| `createAgent(config)` | 创建新 Agent |
| `resumeAgent(agentId, config?)` | 恢复已有 Agent |
| `listModels()` | 列出支持的模型 |

### IAgent

| 方法 | 描述 |
|------|------|
| `send(message, options?)` | 发送提示，返回 IRun |
| `listArtifacts()` | 列出生成的产物 |
| `downloadArtifact(path)` | 下载指定产物 |
| `close()` | 关闭 Agent |

### IRun

| 方法 | 描述 |
|------|------|
| `stream()` | 流式获取事件 (AsyncGenerator) |
| `wait()` | 等待运行完成 |
| `cancel()` | 取消运行 |

## 支持的 Provider

- ✅ Cursor (已实现)
- 🚧 Windsurf (开发中)
- 🚧 Vercel (开发中)
- 🚧 Replit (开发中)

## 项目结构

```
agentsdk/
├── src/
│   ├── types.ts          # 统一接口定义
│   ├── cursor.ts         # Cursor 适配器
│   └── index.ts          # 主入口
├── examples/
│   └── cursor-clone/    # Cursor-like 服务示例
├── package.json
└── tsconfig.json
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（自动编译）
npm run dev

# 构建
npm run build
```

## License

MIT

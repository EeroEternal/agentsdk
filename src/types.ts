/**
 * AgentSDK 统一接口定义
 * 所有 Provider (Cursor, Windsurf, Vercel, Replit) 都实现这些接口
 */

// ============ 核心类型 ============

export interface ModelSelection {
  id: string;
  params?: ModelParameter[];
}

export interface ModelParameter {
  id: string;
  value: string;
}

// ============ 消息类型 ============

export interface UserMessage {
  text: string;
  images?: Image[];
}

export interface Image {
  url?: string;
  data?: string; // base64
  mimeType?: string;
}

export type MessageType = 
  | "assistant"
  | "thinking"
  | "tool_call"
  | "status"
  | "text-delta"
  | "thinking-delta";

export interface SDKMessage {
  type: MessageType;
  [key: string]: any;
}

// ============ Artifact 类型 ============

export interface Artifact {
  path: string;
  sizeBytes: number;
  updatedAt: string;
}

// ============ Agent 接口 ============

export interface AgentConfig {
  apiKey: string;
  model?: ModelSelection;
  workingDirectory?: string; // 本地工作目录
  cloudConfig?: CloudConfig; // 云端配置
  name?: string;
}

export interface CloudConfig {
  repos?: Array<{ url: string; startingRef?: string }>;
  autoCreatePR?: boolean;
  envType?: "cloud" | "pool" | "machine";
}

export interface IAgent {
  readonly agentId: string;
  
  // 发送提示并获取运行实例
  send(message: string | UserMessage, options?: SendOptions): Promise<IRun>;
  
  // 列出产物
  listArtifacts(): Promise<Artifact[]>;
  
  // 下载产物
  downloadArtifact(path: string): Promise<Buffer>;
  
  // 关闭 agent
  close(): Promise<void>;
}

export interface SendOptions {
  model?: ModelSelection;
  onDelta?: (update: any) => void;
  onStep?: (step: any) => void;
}

// ============ Run 接口 ============

export type RunStatus = "running" | "finished" | "error" | "cancelled";

export interface RunResult {
  id: string;
  status: RunStatus;
  result?: string;
  model?: ModelSelection;
  durationMs?: number;
}

export interface IRun {
  readonly id: string;
  readonly agentId: string;
  readonly status: RunStatus;
  
  // 流式获取事件
  stream(): AsyncGenerator<SDKMessage, void>;
  
  // 等待完成
  wait(): Promise<RunResult>;
  
  // 取消运行
  cancel(): Promise<void>;
}

// ============ Factory 接口 ============

export interface IAgentSDK {
  // 创建 agent
  createAgent(config: AgentConfig): Promise<IAgent>;
  
  // 恢复已有 agent
  resumeAgent(agentId: string, config?: Partial<AgentConfig>): Promise<IAgent>;
  
  // 列出支持的模型
  listModels(): Promise<Model[]>;
}

export interface Model {
  id: string;
  displayName: string;
  description?: string;
}

// ============ Provider 类型 ============

export type ProviderType = "cursor" | "windsurf" | "vercel" | "replit" | "custom";

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseURL?: string; // 自定义 endpoint
  options?: Record<string, any>;
}

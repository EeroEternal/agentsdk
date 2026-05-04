/**
 * Vercel AI SDK Provider Adapter (待实现)
 * 
 * 当前状态: 🚧 开发中
 * 
 * 注意: Vercel 提供的是 AI SDK (用于构建 AI 应用)
 * 而不是像 Cursor 那样的编程助手 SDK
 * 
 * 可能需要适配的是:
 * - Vercel AI SDK Core (统一接口调用不同 LLM)
 * - Vercel v0 (生成 UI 代码)
 */

import { IAgentSDK, IAgent, IRun, AgentConfig, RunResult, UserMessage, SendOptions } from "./types";

/**
 * Vercel SDK 主类
 */
export class VercelSDK implements IAgentSDK {
  private apiKey: string;
  private baseURL: string;
  
  constructor(apiKey: string, baseURL: string = "https://api.vercel.com") {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  
  async createAgent(config: AgentConfig): Promise<IAgent> {
    // TODO: 确定 Vercel 的哪个产品需要适配
    // 可能是 v0.dev API 或其他服务
    throw new Error("Vercel adapter not yet implemented - need to clarify which Vercel product to integrate");
  }
  
  async resumeAgent(agentId: string, config?: Partial<AgentConfig>): Promise<IAgent> {
    throw new Error("Vercel adapter not yet implemented");
  }
  
  async listModels(): Promise<any[]> {
    // Vercel AI SDK 支持多种模型 (OpenAI, Anthropic, etc.)
    throw new Error("Vercel adapter not yet implemented");
  }
}

/**
 * Vercel Agent 包装类
 */
class VercelAgentWrapper implements IAgent {
  readonly agentId: string;
  
  constructor(agentId: string) {
    this.agentId = agentId;
  }
  
  async send(message: string | UserMessage, options?: SendOptions): Promise<IRun> {
    throw new Error("Vercel adapter not yet implemented");
  }
  
  async listArtifacts(): Promise<any[]> {
    throw new Error("Vercel adapter not yet implemented");
  }
  
  async downloadArtifact(path: string): Promise<Buffer> {
    throw new Error("Vercel adapter not yet implemented");
  }
  
  async close(): Promise<void> {
    // TODO
  }
}

export default VercelSDK;

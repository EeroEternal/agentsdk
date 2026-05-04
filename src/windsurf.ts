/**
 * Windsurf Provider Adapter (待实现)
 * 
 * 当前状态: 🚧 开发中
 * 
 * 实现步骤:
 * 1. 获取 Windsurf SDK (需要等待官方发布或反向工程 API)
 * 2. 实现 IAgentSDK 接口
 * 3. 实现 IAgent 接口
 * 4. 实现 IRun 接口
 */

import { IAgentSDK, IAgent, IRun, AgentConfig, RunResult, UserMessage, SendOptions } from "./types";

/**
 * Windsurf SDK 主类
 */
export class WindsurfSDK implements IAgentSDK {
  private apiKey: string;
  private baseURL: string;
  
  constructor(apiKey: string, baseURL: string = "https://api.windsurf.com") {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  
  async createAgent(config: AgentConfig): Promise<IAgent> {
    // TODO: 实现 Windsurf Agent 创建逻辑
    throw new Error("Windsurf adapter not yet implemented");
  }
  
  async resumeAgent(agentId: string, config?: Partial<AgentConfig>): Promise<IAgent> {
    // TODO: 实现恢复已有 Agent 的逻辑
    throw new Error("Windsurf adapter not yet implemented");
  }
  
  async listModels(): Promise<any[]> {
    // TODO: 实现获取可用模型列表
    throw new Error("Windsurf adapter not yet implemented");
  }
}

/**
 * Windsurf Agent 包装类
 */
class WindsurfAgentWrapper implements IAgent {
  readonly agentId: string;
  
  constructor(agentId: string) {
    this.agentId = agentId;
  }
  
  async send(message: string | UserMessage, options?: SendOptions): Promise<IRun> {
    throw new Error("Windsurf adapter not yet implemented");
  }
  
  async listArtifacts(): Promise<any[]> {
    throw new Error("Windsurf adapter not yet implemented");
  }
  
  async downloadArtifact(path: string): Promise<Buffer> {
    throw new Error("Windsurf adapter not yet implemented");
  }
  
  async close(): Promise<void> {
    // TODO: 实现关闭 Agent 的逻辑
  }
}

/**
 * Windsurf Run 包装类
 */
class WindsurfRunWrapper implements IRun {
  private runId: string;
  
  constructor(runId: string) {
    this.runId = runId;
  }
  
  get id(): string {
    return this.runId;
  }
  
  get agentId(): string {
    throw new Error("Not implemented");
  }
  
  get status(): any {
    throw new Error("Not implemented");
  }
  
  async *stream(): AsyncGenerator<any, void> {
    // TODO: 实现流式响应
    throw new Error("Windsurf adapter not yet implemented");
  }
  
  async wait(): Promise<RunResult> {
    // TODO: 实现等待完成
    throw new Error("Windsurf adapter not yet implemented");
  }
  
  async cancel(): Promise<void> {
    // TODO: 实现取消运行
    throw new Error("Windsurf adapter not yet implemented");
  }
}

export default WindsurfSDK;

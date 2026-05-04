/**
 * Cursor Provider Adapter
 * 将 Cursor SDK 适配到 AgentSDK 统一接口
 */

import { Agent as CursorAgent, Cursor } from "@cursor/sdk";
import {
  IAgentSDK,
  AgentConfig,
  IAgent,
  IRun,
  RunResult,
  Model,
  UserMessage,
  SendOptions,
} from "./types";

// ============ Cursor Agent 实现 ============

class CursorAgentWrapper implements IAgent {
  private cursorAgent: any; // Cursor SDK Agent 类型
  
  constructor(private agent: any, private apiKey: string) {
    this.cursorAgent = agent;
  }
  
  get agentId(): string {
    return this.cursorAgent.agentId;
  }
  
  async send(message: string | UserMessage, options?: SendOptions): Promise<IRun> {
    const cursorMessage = typeof message === "string" 
      ? message 
      : this.convertUserMessage(message);
    
    const sendOptions: any = {};
    
    if (options?.model) {
      sendOptions.model = options.model;
    }
    
    if (options?.onDelta) {
      sendOptions.onDelta = ({ update }: any) => {
        options.onDelta?.(update);
      };
    }
    
    if (options?.onStep) {
      sendOptions.onStep = ({ step }: any) => {
        options.onStep?.(step);
      };
    }
    
    const run = await this.cursorAgent.send(cursorMessage, sendOptions);
    
    return new CursorRunWrapper(run);
  }
  
  async listArtifacts(): Promise<any[]> {
    return await this.cursorAgent.listArtifacts();
  }
  
  async downloadArtifact(path: string): Promise<Buffer> {
    const buffer = await this.cursorAgent.downloadArtifact(path);
    return Buffer.from(buffer);
  }
  
  async close(): Promise<void> {
    await this.cursorAgent[Symbol.asyncDispose]();
  }
  
  private convertUserMessage(msg: UserMessage): any {
    if (msg.images && msg.images.length > 0) {
      return {
        text: msg.text,
        images: msg.images.map(img => {
          if (img.url) return { url: img.url };
          if (img.data && img.mimeType) return { data: img.data, mimeType: img.mimeType };
          return {};
        }),
      };
    }
    return msg.text;
  }
}

// ============ Cursor Run 实现 ============

class CursorRunWrapper implements IRun {
  constructor(private run: any) {}
  
  get id(): string {
    return this.run.id;
  }
  
  get agentId(): string {
    return this.run.agentId;
  }
  
  get status(): any {
    return this.run.status;
  }
  
  async *stream(): AsyncGenerator<any, void> {
    for await (const event of this.run.stream()) {
      yield this.normalizeEvent(event);
    }
  }
  
  async wait(): Promise<RunResult> {
    const result = await this.run.wait();
    return {
      id: result.id || this.run.id,
      status: result.status,
      result: result.result,
      model: result.model,
      durationMs: result.durationMs,
    };
  }
  
  async cancel(): Promise<void> {
    await this.run.cancel();
  }
  
  private normalizeEvent(event: any): any {
    // 将 Cursor SDK 的事件格式转换为 AgentSDK 统一格式
    return {
      type: event.type,
      ...event,
    };
  }
}

// ============ Cursor SDK 主类 ============

export class CursorSDK implements IAgentSDK {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async createAgent(config: AgentConfig): Promise<IAgent> {
    const cursorOptions: any = {
      apiKey: config.apiKey || this.apiKey,
      model: config.model,
    };
    
    // 本地运行配置
    if (config.workingDirectory) {
      cursorOptions.local = {
        cwd: config.workingDirectory,
      };
    }
    
    // 云端运行配置
    if (config.cloudConfig) {
      cursorOptions.cloud = {
        repos: config.cloudConfig.repos,
        autoCreatePR: config.cloudConfig.autoCreatePR,
        env: config.cloudConfig.envType 
          ? { type: config.cloudConfig.envType } 
          : undefined,
      };
    }
    
    if (config.name) {
      cursorOptions.name = config.name;
    }
    
    const agent = await CursorAgent.create(cursorOptions);
    
    return new CursorAgentWrapper(agent, config.apiKey || this.apiKey);
  }
  
  async resumeAgent(agentId: string, config?: Partial<AgentConfig>): Promise<IAgent> {
    const resumeOptions: any = {
      apiKey: config?.apiKey || this.apiKey,
    };
    
    const agent = await CursorAgent.resume(agentId, resumeOptions);
    
    return new CursorAgentWrapper(agent, config?.apiKey || this.apiKey);
  }
  
  async listModels(): Promise<Model[]> {
    const models = await Cursor.models.list({ apiKey: this.apiKey });
    
    return models.map((m: any) => ({
      id: m.id,
      displayName: m.displayName || m.id,
      description: m.description,
    }));
  }
}

// ============ 导出辅助函数 ============

export async function createCursorAgent(
  apiKey: string,
  config: AgentConfig
): Promise<IAgent> {
  const sdk = new CursorSDK(apiKey);
  return await sdk.createAgent(config);
}

export default CursorSDK;

/**
 * AgentSDK 主入口
 * 统一导出所有 Provider 和接口
 */

// ============ 核心类型导出 ============
export * from "./types";

// ============ Cursor Provider (已实现) ============
export { CursorSDK, createCursorAgent } from "./cursor";

// ============ Windsurf Provider (待实现) ============
export { WindsurfSDK } from "./windsurf";

// ============ Vercel Provider (待实现) ============
export { VercelSDK } from "./vercel";

// ============ Replit Provider (待实现) ============
export { ReplitSDK } from "./replit";

// ============ 工厂函数 ============

import { IAgentSDK, ProviderConfig, ProviderType } from "./types";
import { CursorSDK } from "./cursor";
import { WindsurfSDK } from "./windsurf";
import { VercelSDK } from "./vercel";
import { ReplitSDK } from "./replit";

/**
 * 创建指定 Provider 的 SDK 实例
 */
export function createSDK(provider: ProviderConfig): IAgentSDK {
  switch (provider.type) {
    case "cursor":
      return new CursorSDK(provider.apiKey);
    
    case "windsurf":
      return new WindsurfSDK(provider.apiKey, provider.baseURL);
    
    case "vercel":
      return new VercelSDK(provider.apiKey, provider.baseURL);
    
    case "replit":
      return new ReplitSDK(provider.apiKey, provider.baseURL);
    
    case "custom":
      if (!provider.baseURL) {
        throw new Error("Custom provider requires baseURL");
      }
      throw new Error("Custom provider not yet implemented");
    
    default:
      throw new Error(`Unknown provider type: ${(provider as any).type}`);
  }
}

// ============ 远端网关客户端（自托管 agentsdk.run）============

export {
  AgentsdkRemoteClient,
  type AgentsdkRemoteConfig,
  RemoteAgent,
  type RemoteCreateAgentBody,
  type RemoteModel,
  RemoteRun,
  createRemoteClient,
} from "./remote-client";

// ============ 版本信息 ============
export const VERSION = "0.1.0";

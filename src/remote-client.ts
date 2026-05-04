/**
 * 连接自托管 agentsdk.run（或兼容实现）的薄客户端：
 * 不依赖 @cursor/sdk 原生二进制，仅用 fetch + SSE 驱动云端已接入的 Cursor SDK。
 */

export interface AgentsdkRemoteConfig {
  /** 例如 https://agentsdk.example.com */
  baseURL: string;
  /** Cursor API Key，发往你的网关并由服务端转发至 Cursor Cloud */
  cursorApiKey: string;
}

function joinURL(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

type JsonHeaders = Record<string, string>;

function authHeaders(cursorApiKey: string): JsonHeaders {
  return {
    "Content-Type": "application/json",
    "x-cursor-api-key": cursorApiKey,
  };
}

export interface RemoteCreateAgentBody {
  model?: { id: string };
  /** 仅当 Agent 在云主机本机盘上跑本地模式时有效；一般用 cloudConfig.repos */
  workingDirectory?: string;
  cloudConfig?: {
    repos?: Array<{ url: string; startingRef?: string }>;
    autoCreatePR?: boolean;
    env?: { type: string; name?: string };
  };
  name?: string;
}

export interface RemoteModel {
  id: string;
  displayName: string;
  description?: string;
}

export class AgentsdkRemoteClient {
  constructor(private cfg: AgentsdkRemoteConfig) {}

  private hdr(): JsonHeaders {
    return authHeaders(this.cfg.cursorApiKey);
  }

  async listModels(): Promise<RemoteModel[]> {
    const res = await fetch(joinURL(this.cfg.baseURL, "/api/v1/models"), {
      headers: this.hdr(),
    });
    const j = (await res.json()) as { success?: boolean; models?: RemoteModel[]; error?: string };
    if (!res.ok || !j.success) throw new Error(j.error || `listModels HTTP ${res.status}`);
    return j.models || [];
  }

  async createAgent(body: RemoteCreateAgentBody = {}): Promise<RemoteAgent> {
    const res = await fetch(joinURL(this.cfg.baseURL, "/api/v1/agent/create"), {
      method: "POST",
      headers: this.hdr(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { success?: boolean; agentId?: string; error?: string };
    if (!res.ok || !j.success || !j.agentId) {
      throw new Error(j.error || `createAgent HTTP ${res.status}`);
    }
    return new RemoteAgent(this.cfg, j.agentId);
  }

  resumeAgent(agentId: string): RemoteAgent {
    return new RemoteAgent(this.cfg, agentId);
  }
}

/** 远端 Agent 句柄（无本地 @cursor/sdk） */
export class RemoteAgent {
  constructor(
    private cfg: AgentsdkRemoteConfig,
    readonly agentId: string
  ) {}

  private hdr(): JsonHeaders {
    return authHeaders(this.cfg.cursorApiKey);
  }

  /**
   * 发起一轮对话，返回 RemoteRun。
   * 需调用 {@link RemoteRun.finish}：若需要流式回调则传入 onEvent；仅需结果可 `finish()`。
   */
  async send(
    message: string | Record<string, unknown>,
    sendOptions?: { model?: unknown; local?: unknown; mcpServers?: unknown }
  ): Promise<RemoteRun> {
    const res = await fetch(joinURL(this.cfg.baseURL, `/api/v1/agent/${this.agentId}/send`), {
      method: "POST",
      headers: this.hdr(),
      body: JSON.stringify({ message, options: sendOptions }),
    });
    const j = (await res.json()) as { success?: boolean; runId?: string; agentId?: string; error?: string };
    if (!res.ok || !j.success || !j.runId) {
      throw new Error(j.error || `send HTTP ${res.status}`);
    }
    return new RemoteRun(this.cfg, j.agentId || this.agentId, j.runId);
  }

  async listArtifacts(): Promise<unknown[]> {
    const res = await fetch(joinURL(this.cfg.baseURL, `/api/v1/agent/${this.agentId}/artifacts`), {
      headers: this.hdr(),
    });
    const j = (await res.json()) as { success?: boolean; artifacts?: unknown[]; error?: string };
    if (!res.ok || !j.success) throw new Error(j.error || `artifacts HTTP ${res.status}`);
    return j.artifacts || [];
  }

  async close(): Promise<void> {
    const res = await fetch(joinURL(this.cfg.baseURL, `/api/v1/agent/${this.agentId}`), {
      method: "DELETE",
      headers: this.hdr(),
    });
    const j = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !j.success) throw new Error(j.error || `close HTTP ${res.status}`);
  }
}

export class RemoteRun {
  constructor(
    private cfg: AgentsdkRemoteConfig,
    readonly agentId: string,
    readonly runId: string
  ) {}

  private hdr(): JsonHeaders {
    return authHeaders(this.cfg.cursorApiKey);
  }

  async *streamEvents(): AsyncGenerator<unknown, void, void> {
    const url = joinURL(this.cfg.baseURL, `/api/v1/agent/${this.agentId}/run/${this.runId}/stream`);
    const res = await fetch(url, { headers: authHeaders(this.cfg.cursorApiKey) });
    if (!res.ok) {
      throw new Error(`stream HTTP ${res.status}`);
    }
    if (!res.body) throw new Error("stream: empty body");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const rawLine of chunk.split("\n")) {
          const line = rawLine.trimEnd();
          if (!line.startsWith("data: ")) continue;
          const data = line.slice("data: ".length).trim();
          if (data === "[DONE]" || data === `"[DONE]"`) return;
          try {
            const parsed = JSON.parse(data) as unknown;
            yield parsed;
          } catch {
            /* 忽略单行解析失败 */
          }
        }
      }
    }
  }

  async wait(): Promise<unknown> {
    const res = await fetch(
      joinURL(this.cfg.baseURL, `/api/v1/agent/${this.agentId}/run/${this.runId}/wait`),
      { method: "POST", headers: this.hdr() }
    );
    const j = (await res.json()) as { success?: boolean; result?: unknown; error?: string };
    if (!res.ok || !j.success) throw new Error(j.error || `wait HTTP ${res.status}`);
    return j.result;
  }

  /**
   * 若提供 onEvent，则消费完整 SSE（与 Cursor run.stream() 等价的一次读取），再调用服务端 wait。
   * 不传 onEvent 时仅阻塞等待最终结果（不向 SSE 拉流）。
   */
  async finish(onEvent?: (ev: unknown) => void): Promise<unknown> {
    if (onEvent) {
      for await (const ev of this.streamEvents()) {
        onEvent(ev);
      }
    }
    return this.wait();
  }

  async cancel(): Promise<void> {
    const res = await fetch(
      joinURL(this.cfg.baseURL, `/api/v1/agent/${this.agentId}/run/${this.runId}/cancel`),
      { method: "POST", headers: this.hdr() }
    );
    const j = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !j.success) throw new Error(j.error || `cancel HTTP ${res.status}`);
  }
}

export function createRemoteClient(cfg: AgentsdkRemoteConfig): AgentsdkRemoteClient {
  return new AgentsdkRemoteClient(cfg);
}

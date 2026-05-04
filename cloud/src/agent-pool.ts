/**
 * Agent / Run 实例池：同一进程内保留 Cursor SDK 对象引用，供 SSE 续读
 */

import type { Run, SDKAgent } from "@cursor/sdk";

interface PoolEntry {
  agent: SDKAgent;
  runs: Map<string, Run>;
  createdAt: number;
}

class AgentPool {
  private pool = new Map<string, PoolEntry>();

  add(agentId: string, agent: SDKAgent) {
    this.pool.set(agentId, {
      agent,
      runs: new Map(),
      createdAt: Date.now(),
    });
  }

  get(agentId: string): SDKAgent | undefined {
    return this.pool.get(agentId)?.agent;
  }

  remove(agentId: string) {
    this.pool.delete(agentId);
  }

  addRun(agentId: string, run: Run) {
    const entry = this.pool.get(agentId);
    if (entry) {
      entry.runs.set(run.id, run);
    }
  }

  getRun(agentId: string, runId: string): Run | undefined {
    return this.pool.get(agentId)?.runs.get(runId);
  }

  cleanup() {
    const now = Date.now();
    const TTL = 60 * 60 * 1000;
    const stale: Array<{ agentId: string; entry: PoolEntry }> = [];
    for (const [agentId, entry] of this.pool.entries()) {
      if (now - entry.createdAt > TTL) stale.push({ agentId, entry });
    }
    for (const { agentId, entry } of stale) {
      void entry.agent[Symbol.asyncDispose]()
        .catch(() => {})
        .finally(() => {
          this.pool.delete(agentId);
          console.log(`Agent pool TTL cleanup: ${agentId}`);
        });
    }
  }
}

export const agentPool = new AgentPool();

setInterval(() => {
  agentPool.cleanup();
}, 10 * 60 * 1000);

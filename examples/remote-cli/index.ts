/**
 * 本地薄 CLI：通过 agentsdk.run 网关，在日本 VPS 上固定目录跑 Cursor 本地 Agent。
 *
 * 环境变量：
 * - AGENTSDK_CLOUD_URL（必填）
 * - CURSOR_API_KEY（必填）
 * - CLOUD_AGENT_CWD（可选）覆盖远端工作目录（路径须存在于 VPS）；不设则服务端用 DEFAULT_AGENT_CWD
 * - CURSOR_MODEL（可选）默认模型 id；会话内可用 /model <id> 切换后续对话所用模型
 */

import path from "node:path";
import * as dotenv from "dotenv";
import * as readline from "readline";
import { createRemoteClient } from "../../src";

const rootEnv = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: rootEnv });
dotenv.config();

const cloudURL = process.env.AGENTSDK_CLOUD_URL || "";
const apiKey = process.env.CURSOR_API_KEY || "";
const overrideCwd = process.env.CLOUD_AGENT_CWD?.trim();

if (!cloudURL || !apiKey) {
  console.error("请设置 AGENTSDK_CLOUD_URL 与 CURSOR_API_KEY（可写入仓库根目录的 .env）");
  console.error(`  预期路径: ${rootEnv}`);
  console.error("  可参考: cp .env.example .env");
  process.exit(1);
}

function renderStreamEvent(ev: unknown): void {
  if (ev == null || typeof ev !== "object") return;
  const o = ev as Record<string, unknown>;

  // 部分流为 LocalRunStream：{ type: "sdk_message", message: SDKMessage }
  if (o.type === "sdk_message" && o.message != null && typeof o.message === "object") {
    renderStreamEvent(o.message);
    return;
  }

  switch (o.type) {
    case "assistant": {
      const msg = o.message as { content?: unknown[] } | undefined;
      if (!Array.isArray(msg?.content)) return;
      for (const block of msg.content) {
        if (!block || typeof block !== "object") continue;
        const b = block as { type?: string; text?: string };
        if (b.type === "text" && typeof b.text === "string") {
          process.stdout.write(b.text);
        }
      }
      return;
    }
    case "thinking": {
      const t = o.text;
      if (typeof t === "string" && t.length > 0) {
        process.stderr.write(`\n[thinking] ${t}\n`);
      }
      return;
    }
    case "text-delta": {
      const text = o.text;
      if (typeof text === "string") process.stdout.write(text);
      return;
    }
    case "status":
    case "tool_call":
    case "task":
      return;
    default:
      return;
  }
}

async function main(): Promise<void> {
  const client = createRemoteClient({
    baseURL: cloudURL,
    cursorApiKey: apiKey,
  });

  console.log("🌐 Remote AgentSDK CLI →", cloudURL, "\n");

  const models = await client.listModels();
  console.log("模型:");
  models.slice(0, 12).forEach((m) => console.log(`  - ${m.id}`));
  if (models.length > 12) console.log(`  … 共 ${models.length} 个\n`);
  else console.log("");

  let currentModel = process.env.CURSOR_MODEL || "composer-2";

  const createBody = {
    model: { id: currentModel },
    name: "remote-cli",
    ...(overrideCwd ? { workingDirectory: overrideCwd } : {}),
  };

  const agent = await client.createAgent(createBody);

  console.log("Agent:", agent.agentId);
  console.log(
    overrideCwd
      ? `工作目录(VPS): ${overrideCwd}（由 CLOUD_AGENT_CWD 指定）`
      : "工作目录(VPS): 使用服务端 DEFAULT_AGENT_CWD"
  );
  console.log(`当前模型: ${currentModel}（可用 /model gpt-5.4 切换）\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (): void => {
    rl.question("You: ", async (line) => {
      const trimmed = line.trim();
      if (trimmed === "exit") {
        await agent.close().catch(() => {});
        rl.close();
        process.exit(0);
      }
      if (trimmed === "/model") {
        console.log(`当前模型 id: ${currentModel}；用法示例: /model gpt-5.4\n`);
        ask();
        return;
      }
      const modelCmd = trimmed.match(/^\/model\s+(\S+)/);
      if (modelCmd) {
        currentModel = modelCmd[1];
        console.log(`已切换模型为: ${currentModel}\n`);
        ask();
        return;
      }
      if (trimmed === "artifacts") {
        const arts = await agent.listArtifacts();
        console.log(JSON.stringify(arts, null, 2));
        ask();
        return;
      }
      if (!trimmed) {
        ask();
        return;
      }
      console.log("Agent:");
      const run = await agent.send(trimmed, { model: { id: currentModel } });
      await run.finish((ev) => {
        renderStreamEvent(ev);
      });
      console.log("\n");
      ask();
    });
  };

  ask();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

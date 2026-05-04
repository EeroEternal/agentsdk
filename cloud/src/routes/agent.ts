/**
 * Agent 路由：服务端持有 Cursor Agent 运行时，客户端通过 REST + SSE 驱动
 */

import { Router, Request, Response, NextFunction } from "express";
import { Agent as CursorAgent } from "@cursor/sdk";
import { AuthRequest } from "../types";
import { agentPool } from "../agent-pool";

const router = Router();

const asyncHandler =
  (fn: (req: AuthRequest, res: Response, next?: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
  };

function sanitizeSendOptions(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (o.model) out.model = o.model;
  if (o.local) out.local = o.local;
  if (o.mcpServers) out.mcpServers = o.mcpServers;
  return out;
}

/**
 * POST /api/v1/agent/create
 */
router.post(
  "/create",
  asyncHandler(async (req, res) => {
    try {
      const { model, workingDirectory, cloudConfig, name } = req.body as Record<string, unknown>;

      const agentOptions: Record<string, unknown> = {
        apiKey: req.apiKey,
        model: model || { id: "composer-2" },
      };

      if (name && typeof name === "string") {
        agentOptions.name = name;
      }

      if (cloudConfig && typeof cloudConfig === "object") {
        agentOptions.cloud = cloudConfig;
      } else {
        const cwdFromBody =
          typeof workingDirectory === "string" && workingDirectory.trim()
            ? workingDirectory.trim()
            : "";
        const cwdFromEnv = (process.env.DEFAULT_AGENT_CWD || "").trim();
        const cwd = cwdFromBody || cwdFromEnv;

        if (!cwd) {
          res.status(400).json({
            success: false,
            error:
              "未配置本地工作目录：请在服务器设置 DEFAULT_AGENT_CWD，或在 POST body 中传入 workingDirectory。",
          });
          return;
        }

        agentOptions.local = { cwd };
      }

      const agent = await CursorAgent.create(agentOptions as never);
      agentPool.add(agent.agentId, agent);

      res.json({
        success: true,
        agentId: agent.agentId,
        model: agent.model,
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  })
);

/**
 * DELETE /api/v1/agent/:agentId — 关闭并移出实例池
 */
router.delete(
  "/:agentId",
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const agent = agentPool.get(agentId);
    if (!agent) {
      res.status(404).json({ success: false, error: "Agent not found in pool" });
      return;
    }
    try {
      await agent[Symbol.asyncDispose]();
    } finally {
      agentPool.remove(agentId);
    }
    res.json({ success: true, agentId });
  })
);

/**
 * POST /api/v1/agent/:agentId/send
 */
router.post(
  "/:agentId/send",
  asyncHandler(async (req, res) => {
    try {
      const { agentId } = req.params;
      const { message, options } = req.body as { message?: unknown; options?: unknown };

      let agent = agentPool.get(agentId);
      if (!agent) {
        agent = await CursorAgent.resume(agentId, { apiKey: req.apiKey });
        agentPool.add(agentId, agent);
      }

      const sendOpts = sanitizeSendOptions(options);
      const run = await agent.send(message as never, sendOpts as never);
      agentPool.addRun(agentId, run);

      res.json({
        success: true,
        runId: run.id,
        agentId: run.agentId,
        status: run.status,
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  })
);

/**
 * GET /api/v1/agent/:agentId/run/:runId/stream — SSE
 */
router.get(
  "/:agentId/run/:runId/stream",
  asyncHandler(async (req, res) => {
    const { agentId, runId } = req.params;
    const run = agentPool.getRun(agentId, runId);

    if (!run) {
      res.status(404).json({
        success: false,
        error: "Run not found. Send a message first with the same server instance.",
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      for await (const event of run.stream()) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.write(`data: "[DONE]"\n\n`);
    } catch (error: unknown) {
      const err = error as Error;
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    } finally {
      res.end();
    }
  })
);

/**
 * POST /api/v1/agent/:agentId/run/:runId/wait — 非流式等到结束
 */
router.post(
  "/:agentId/run/:runId/wait",
  asyncHandler(async (req, res) => {
    const { agentId, runId } = req.params;
    const run = agentPool.getRun(agentId, runId);
    if (!run) {
      res.status(404).json({
        success: false,
        error: "Run not found.",
      });
      return;
    }
    const result = await run.wait();
    res.json({ success: true, result });
  })
);

/**
 * POST /api/v1/agent/:agentId/run/:runId/cancel
 */
router.post(
  "/:agentId/run/:runId/cancel",
  asyncHandler(async (req, res) => {
    const { agentId, runId } = req.params;
    const run = agentPool.getRun(agentId, runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found." });
      return;
    }
    await run.cancel();
    res.json({ success: true, runId });
  })
);

/**
 * GET /api/v1/agent/:agentId/artifacts
 */
router.get(
  "/:agentId/artifacts",
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    let agent = agentPool.get(agentId);
    if (!agent) {
      agent = await CursorAgent.resume(agentId, { apiKey: req.apiKey });
      agentPool.add(agentId, agent);
    }
    const list = await agent.listArtifacts();
    res.json({ success: true, artifacts: list });
  })
);

/**
 * GET /api/v1/agent/:agentId/runs
 */
router.get(
  "/:agentId/runs",
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    try {
      const result = await CursorAgent.listRuns(agentId, { apiKey: req.apiKey, runtime: "cloud" });
      res.json({ success: true, runs: result.items, nextCursor: result.nextCursor });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  })
);

export default router;

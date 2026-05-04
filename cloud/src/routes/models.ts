/**
 * GET /api/v1/models — 列出模型（使用 attachCursorAuth 注入的 req.apiKey）
 */

import { Router, Request, Response, NextFunction } from "express";
import { Cursor } from "@cursor/sdk";
import { AuthRequest } from "../types";

const router = Router();

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res)).catch(next);
  };

router.get(
  "/",
  asyncHandler(async (req, res) => {
    try {
      const models = await Cursor.models.list({ apiKey: req.apiKey });
      res.json({
        success: true,
        models: models.map((m) => ({
          id: m.id,
          displayName: m.displayName || m.id,
          description: m.description,
        })),
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  })
);

export default router;

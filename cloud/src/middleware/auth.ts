/**
 * Cursor API Key：来自客户端转发，或由服务端环境变量兜底（单机/内网网关场景）
 */

import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types";

function extractBearer(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim();
}

/**
 * 将 Cursor API Key 解析到 req.apiKey
 * 优先级：x-cursor-api-key > Authorization Bearer > x-api-key > 环境变量 CURSOR_API_KEY
 */
export function attachCursorAuth(req: Request, res: Response, next: NextFunction) {
  const fromHeader =
    (req.headers["x-cursor-api-key"] as string) ||
    extractBearer(req.headers.authorization) ||
    (req.headers["x-api-key"] as string);

  const fromEnv = process.env.CURSOR_API_KEY;
  const key = fromHeader || fromEnv;

  if (!key) {
    return res.status(401).json({
      success: false,
      error:
        "未提供 Cursor API Key。请设置 Header: x-cursor-api-key 或 Authorization: Bearer <key>，或在服务端配置 CURSOR_API_KEY",
    });
  }

  (req as AuthRequest).apiKey = key;
  next();
}

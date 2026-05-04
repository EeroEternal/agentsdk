/**
 * 类型定义
 */

import { Request } from "express";

/**
 * 扩展 Express Request，添加 apiKey 字段
 */
export interface AuthRequest extends Request {
  apiKey: string;
}

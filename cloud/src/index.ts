/**
 * AgentSDK Cloud Backend (agentsdk.run)
 */

import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import AgentRouter from "./routes/agent";
import ModelRouter from "./routes/models";
import { attachCursorAuth } from "./middleware/auth";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Routes（所有业务接口需带 Cursor API Key，便于在「允许地域」的服务器上代跑 SDK）
app.use("/api/v1/agent", attachCursorAuth, AgentRouter);
app.use("/api/v1/models", attachCursorAuth, ModelRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log("AgentSDK Cloud Backend (agentsdk.run) listening");
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log(`  NODE_ENV=${process.env.NODE_ENV || "development"}`);
});

export default app;

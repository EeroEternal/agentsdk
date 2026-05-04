/**
 * 示例：用 AgentSDK 组装一个 Cursor-like 服务
 * 
 * 功能：
 * 1. 创建一个本地 Agent
 * 2. 发送提示并流式接收响应
 * 3. 显示思考过程
 * 4. 列出生成的产物
 */

import { createSDK, ProviderConfig } from "../../src";
import * as readline from "readline";

// ============ 配置 ============

const config: ProviderConfig = {
  type: "cursor",
  apiKey: process.env.CURSOR_API_KEY || "",
};

if (!config.apiKey) {
  console.error("❌ 请设置环境变量: CURSOR_API_KEY");
  console.error("   获取方式: https://cursor.com/dashboard/integrations");
  process.exit(1);
}

// ============ 主程序 ============

async function main() {
  console.log("🚀 AgentSDK - Cursor Clone 示例\n");
  
  // 1. 创建 SDK 实例
  const sdk = createSDK(config);
  
  // 2. 列出可用模型
  console.log("📦 可用模型:");
  const models = await sdk.listModels();
  models.forEach((m) => {
    console.log(`   - ${m.id}: ${m.displayName}`);
  });
  console.log("");
  
  // 3. 创建 Agent (本地模式)
  console.log("🔧 创建本地 Agent...");
  const agent = await sdk.createAgent({
    apiKey: config.apiKey,
    model: { id: "composer-2" },
    workingDirectory: process.cwd(),
    name: "my-cursor-agent",
  });
  
  console.log(`✅ Agent 已创建: ${agent.agentId}\n`);
  
  // 4. 交互式对话
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  console.log('💬 开始对话 (输入 "exit" 退出, "artifacts" 查看产物)\n');
  
  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (input === "exit") {
        console.log("\n👋 再见!");
        await agent.close();
        rl.close();
        process.exit(0);
      }
      
      if (input === "artifacts") {
        const artifacts = await agent.listArtifacts();
        console.log("\n📁 生成的产物:");
        artifacts.forEach((a: any) => {
          console.log(`   - ${a.path} (${a.sizeBytes} bytes)`);
        });
        console.log("");
        askQuestion();
        return;
      }
      
      // 发送提示并流式显示响应
      console.log("\n🤖 Agent:");
      
      try {
        const run = await agent.send(input, {
          onDelta: ({ text, type }: any) => {
            if (type === "text-delta") {
              process.stdout.write(text);
            }
          },
          onStep: ({ step }: any) => {
            if (step.type === "thinking") {
              console.log("\n💭 [思考中...]");
            }
          },
        });
        
        console.log("\n");
        
        // 等待完成
        const result = await run.wait();
        console.log(`✅ 完成 (状态: ${result.status}, 耗时: ${result.durationMs}ms)\n`);
        
      } catch (error: any) {
        console.error(`❌ 错误: ${error.message}\n`);
      }
      
      askQuestion();
    });
  };
  
  askQuestion();
}

// ============ 错误处理 ============

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

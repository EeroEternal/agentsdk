#!/usr/bin/env node
/**
 * AgentSDK CLI - 命令行测试工具
 * 
 * 用法:
 *   agentsdk chat                    # 启动交互式对话
 *   agentsdk chat --model composer-2 # 指定模型
 *   agentsdk models                  # 列出可用模型
 *   agentsdk run "prompt"            # 单次提示
 */

import { program } from "commander";
import { createSDK, ProviderConfig } from "./index";
import * as readline from "readline";
import * as dotenv from "dotenv";

// 加载 .env
dotenv.config();

// ============ CLI 配置 ============

program
  .name("agentsdk")
  .description("AgentSDK CLI - 测试 AI 编程助手")
  .version("0.1.0");

// ============ 命令: chat (交互式对话) ============

program
  .command("chat")
  .description("启动交互式对话")
  .option("-m, --model <model>", "指定模型", "composer-2")
  .option("-p, --provider <provider>", "指定 provider (cursor/windsurf/vercel/replit)", "cursor")
  .option("-d, --dir <directory>", "工作目录", process.cwd())
  .action(async (options) => {
    await handleChat(options);
  });

// ============ 命令: models (列出模型) ============

program
  .command("models")
  .description("列出可用模型")
  .option("-p, --provider <provider>", "指定 provider", "cursor")
  .action(async (options) => {
    await handleListModels(options);
  });

// ============ 命令: run (单次提示) ============

program
  .command("run <prompt>")
  .description("发送单次提示")
  .option("-m, --model <model>", "指定模型", "composer-2")
  .option("-p, --provider <provider>", "指定 provider", "cursor")
  .option("-d, --dir <directory>", "工作目录", process.cwd())
  .action(async (prompt, options) => {
    await handleRun(prompt, options);
  });

// ============ 处理器 ============

async function handleChat(options: any) {
  console.log("🚀 AgentSDK CLI - 交互式对话\n");
  
  const sdk = createSDKInstance(options.provider);
  if (!sdk) return;
  
  console.log(`📦 使用 Provider: ${options.provider}`);
  console.log(`🧠 使用模型: ${options.model}`);
  console.log(`📁 工作目录: ${options.dir}\n`);
  
  // 创建 Agent
  console.log("🔧 创建 Agent...");
  const agent = await sdk.createAgent({
    apiKey: getApiKey(options.provider),
    model: { id: options.model },
    workingDirectory: options.dir,
  });
  
  console.log(`✅ Agent 已创建: ${agent.agentId}\n`);
  console.log('💬 开始对话 (输入 "exit" 退出, "artifacts" 查看产物)\n');
  
  // 交互式对话
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
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
      
      // 发送提示
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

async function handleListModels(options: any) {
  console.log(`📦 列出 ${options.provider} 的可用模型...\n`);
  
  const sdk = createSDKInstance(options.provider);
  if (!sdk) return;
  
  try {
    const models = await sdk.listModels();
    
    console.log("可用模型:");
    models.forEach((m: any) => {
      console.log(`  - ${m.id}: ${m.displayName}`);
      if (m.description) {
        console.log(`    ${m.description}`);
      }
    });
  } catch (error: any) {
    console.error(`❌ 错误: ${error.message}`);
  }
}

async function handleRun(prompt: string, options: any) {
  console.log("🚀 AgentSDK CLI - 单次提示\n");
  
  const sdk = createSDKInstance(options.provider);
  if (!sdk) return;
  
  console.log(`📦 Provider: ${options.provider}`);
  console.log(`🧠 模型: ${options.model}`);
  console.log(`💬 提示: ${prompt}\n`);
  
  // 创建 Agent
  const agent = await sdk.createAgent({
    apiKey: getApiKey(options.provider),
    model: { id: options.model },
    workingDirectory: options.dir,
  });
  
  console.log(`✅ Agent 已创建: ${agent.agentId}\n`);
  console.log("🤖 Agent:");
  
  // 发送提示
  try {
    const run = await agent.send(prompt, {
      onDelta: ({ text, type }: any) => {
        if (type === "text-delta") {
          process.stdout.write(text);
        }
      },
    });
    
    console.log("\n");
    
    // 等待完成
    const result = await run.wait();
    console.log(`\n✅ 完成 (状态: ${result.status}, 耗时: ${result.durationMs}ms)`);
    
  } catch (error: any) {
    console.error(`❌ 错误: ${error.message}`);
  }
  
  await agent.close();
  process.exit(0);
}

// ============ 辅助函数 ============

function createSDKInstance(provider: string): any {
  const apiKey = getApiKey(provider);
  
  if (!apiKey) {
    console.error(`❌ 错误: 未找到 ${provider.toUpperCase()}_API_KEY`);
    console.error(`   请设置环境变量或在 .env 文件中配置`);
    process.exit(1);
  }
  
  const config: ProviderConfig = {
    type: provider as any,
    apiKey,
  };
  
  try {
    return createSDK(config);
  } catch (error: any) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

function getApiKey(provider: string): string | undefined {
  const envVar = `${provider.toUpperCase()}_API_KEY`;
  return process.env[envVar];
}

// ============ 运行 CLI ============

program.parse();

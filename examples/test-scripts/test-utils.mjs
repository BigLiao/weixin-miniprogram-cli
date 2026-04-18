/**
 * 测试工具 - 所有测试脚本共用的辅助函数
 */

import { SharedContext } from '../../build/context.js';
import { registry } from '../../build/registry.js';
import { allCommands } from '../../build/commands/index.js';
import { coerceArgs } from '../../build/parser.js';

// 注册所有命令
registry.registerAll(allCommands);

// 项目路径（指向 miniprogram-demo）
const __dirname = new URL('.', import.meta.url).pathname;
export const DEMO_PROJECT_PATH = new URL('../miniprogram-demo', import.meta.url).pathname.replace(/\/$/, '');

// 全局上下文
export const ctx = new SharedContext();

// 测试统计
let passed = 0;
let failed = 0;
let skipped = 0;

/**
 * 执行一个命令并返回结果
 */
export async function run(commandName, args = {}) {
  const cmd = registry.get(commandName);
  if (!cmd) {
    throw new Error(`未知命令: ${commandName}`);
  }
  const coerced = coerceArgs(args, cmd.args);
  return await cmd.handler(coerced, ctx);
}

/**
 * 断言：测试用例
 */
export function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

/**
 * 跳过测试
 */
export function skip(message) {
  skipped++;
  console.log(`  ⏭️  ${message} (skipped)`);
}

/**
 * 测试分组
 */
export function describe(groupName, fn) {
  console.log(`\n📦 ${groupName}`);
  return fn();
}

/**
 * 打印测试结果汇总
 */
export function summary() {
  const total = passed + failed + skipped;
  console.log('\n' + '═'.repeat(50));
  console.log(`📊 测试结果: ${total} 总计, ✅ ${passed} 通过, ❌ ${failed} 失败, ⏭️  ${skipped} 跳过`);
  console.log('═'.repeat(50));
  return failed === 0;
}

/**
 * 清理：断开连接
 */
export async function cleanup() {
  if (ctx.miniProgram || ctx.projectPath) {
    const closeCmd = registry.get('close');
    if (closeCmd) {
      try {
        await closeCmd.handler({}, ctx);
      } catch {}
    }
  }
  if (ctx.miniProgram || ctx.projectPath) {
    try {
      await ctx.miniProgram?.disconnect();
    } catch {}
    ctx.reset();
  }
}

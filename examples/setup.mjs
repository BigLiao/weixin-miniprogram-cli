#!/usr/bin/env node

/**
 * 检查示例项目是否就绪
 *
 * 用法: node examples/setup.mjs
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEMO_PROJECT = join(__dirname, 'miniprogram-demo');

async function main() {
  console.log('📦 检查示例项目');
  console.log(`   路径: ${DEMO_PROJECT}`);
  console.log('');

  if (!existsSync(DEMO_PROJECT)) {
    console.error('❌ 示例项目不存在');
    console.error('   请确认 examples/miniprogram-demo/ 目录完整');
    process.exit(1);
  }

  const configPath = join(DEMO_PROJECT, 'project.config.json');
  if (!existsSync(configPath)) {
    console.error('❌ project.config.json 不存在');
    process.exit(1);
  }

  const appJsonPath = join(DEMO_PROJECT, 'app.json');
  if (!existsSync(appJsonPath)) {
    console.error('❌ app.json 不存在');
    process.exit(1);
  }

  console.log('✅ 示例项目就绪');
  console.log('');
  console.log('下一步:');
  console.log('  1. npm run launch        # 启动开发者工具 + 登录');
  console.log('  2. npm start             # 进入 CLI REPL');
  console.log('  3. npm test              # 运行单元测试');
}

main().catch(e => {
  console.error(`❌ 检查失败: ${e.message}`);
  process.exit(1);
});

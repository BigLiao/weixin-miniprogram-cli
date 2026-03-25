#!/usr/bin/env node

/**
 * 启动微信开发者工具并打开 demo 项目 + 唤起登录
 *
 * 用法:
 *   node examples/launch.mjs                # 启动 + 打开项目 + 登录（终端显示二维码）
 *   node examples/launch.mjs --skip-login   # 只打开项目，不登录
 *   node examples/launch.mjs --qr-image     # 登录二维码保存为图片
 */

import { execSync, exec } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===================== 配置 =====================

const DEMO_PROJECT = resolve(join(__dirname, 'miniprogram-demo'));

// 微信开发者工具 CLI 路径
const CLI_PATHS = [
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli',
  // Windows 常见路径
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
];

// ===================== 工具函数 =====================

function findCli() {
  for (const p of CLI_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { encoding: 'utf-8', timeout: 120000, ...opts });
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    skipLogin: args.includes('--skip-login'),
    qrImage: args.includes('--qr-image'),
    port: getArgValue(args, '--port'),
  };
}

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

// ===================== 主流程 =====================

async function main() {
  const opts = parseArgs();

  console.log('');
  console.log('🚀 启动微信开发者工具');
  console.log('');

  // 1. 检查 CLI
  const cli = findCli();
  if (!cli) {
    console.error('❌ 未找到微信开发者工具 CLI');
    console.error('   请确认已安装微信开发者工具');
    console.error('   检查路径:', CLI_PATHS.join('\n              '));
    process.exit(1);
  }
  console.log(`✅ CLI: ${cli}`);

  // 2. 检查 demo 项目
  if (!existsSync(DEMO_PROJECT)) {
    console.error(`❌ 示例项目不存在: ${DEMO_PROJECT}`);
    console.error('   请先运行: npm run setup');
    process.exit(1);
  }
  console.log(`✅ 项目: ${DEMO_PROJECT}`);
  console.log('');

  // 3. 打开项目（同时启动开发者工具）
  console.log('📂 打开项目...');
  try {
    const portArg = opts.port ? ` --port ${opts.port}` : '';
    const output = run(`"${cli}" open --project "${DEMO_PROJECT}"${portArg}`);
    if (output.trim()) console.log(`   ${output.trim()}`);
    console.log('✅ 项目已打开');
  } catch (e) {
    console.error(`⚠️  打开项目: ${e.message}`);
    console.error('   开发者工具可能需要一些时间启动，继续...');
  }
  console.log('');

  // 4. 登录
  if (!opts.skipLogin) {
    console.log('🔐 唤起登录...');
    console.log('   请使用微信扫描下方二维码：');
    console.log('');

    try {
      const qrFormat = opts.qrImage ? 'image' : 'terminal';
      const qrOutput = opts.qrImage ? ' --qr-output /tmp/wx-login-qr.png' : '';

      const loginOutput = run(
        `"${cli}" login --qr-format ${qrFormat}${qrOutput}`,
        { stdio: opts.qrImage ? 'pipe' : 'inherit', timeout: 180000 }
      );

      if (opts.qrImage) {
        console.log(`   二维码已保存到: /tmp/wx-login-qr.png`);
        // macOS 自动打开图片
        if (process.platform === 'darwin') {
          exec('open /tmp/wx-login-qr.png');
        }
      }

      console.log('');
      console.log('✅ 登录完成');
    } catch (e) {
      console.error(`⚠️  登录: ${e.message}`);
      console.error('   你可以稍后手动登录，或重新运行此脚本');
    }
  } else {
    console.log('⏭️  跳过登录 (--skip-login)');
  }

  console.log('');

  // 5. 启用自动化
  console.log('🤖 启用自动化端口...');
  try {
    const autoOutput = run(`"${cli}" auto --project "${DEMO_PROJECT}" --auto-port 9420`);
    if (autoOutput.trim()) console.log(`   ${autoOutput.trim()}`);
    console.log('✅ 自动化已启用 (端口 9420)');
  } catch (e) {
    console.error(`⚠️  自动化启用: ${e.message}`);
    console.error('   请在开发者工具中手动开启: 设置 → 安全 → 服务端口');
  }

  console.log('');
  console.log('═'.repeat(50));
  console.log('🎉 准备就绪！现在可以：');
  console.log('');
  console.log('   # 启动 CLI REPL');
  console.log('   npm start');
  console.log('');
  console.log('   # 在 REPL 中连接');
  console.log(`   wx> connect_devtools --project ${DEMO_PROJECT}`);
  console.log('');
  console.log('   # 或运行集成测试');
  console.log('   npm run test:all');
  console.log('═'.repeat(50));
}

main().catch(e => {
  console.error(`❌ 启动失败: ${e.message}`);
  process.exit(1);
});

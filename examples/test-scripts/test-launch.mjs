/**
 * 测试: 启动 IDE 并打开 demo 项目
 *
 * 流程:
 *   1. 检查 CLI 路径
 *   2. 打开 demo 项目（自动启动 IDE）
 *   3. 检查登录状态，未登录则显示二维码等待扫码
 *   4. 启用自动化端口
 *
 * 用法:
 *   node examples/test-scripts/test-launch.mjs
 *   node examples/test-scripts/test-launch.mjs --skip-login
 */

import { run, assert, describe, summary, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';
import { findCliPath } from '../../build/utils/ide-cli.js';
import { loadPersistedConfig } from '../../build/commands/config.js';
import { spawnSync } from 'child_process';

const skipLogin = process.argv.includes('--skip-login');

// 加载持久化配置
loadPersistedConfig(ctx);

async function main() {
  console.log('🚀 测试: 启动 IDE 并打开 demo 项目');
  console.log(`   项目路径: ${DEMO_PROJECT_PATH}`);
  console.log('');

  // ========== Step 1: 检查 CLI ==========
  await describe('检查 IDE CLI', async () => {
    const cliPath = findCliPath(ctx);
    assert(cliPath !== null, `CLI 路径已找到: ${cliPath}`);
    if (!cliPath) {
      console.error('\n❌ 无法继续：未找到微信开发者工具 CLI');
      console.error('   请安装微信开发者工具或通过 config --cliPath 指定路径');
      process.exit(1);
    }
  });

  // ========== Step 2: 打开项目 ==========
  await describe('ide-open（打开 demo 项目）', async () => {
    const result = await run('ide-open', { project: DEMO_PROJECT_PATH });
    console.log(`    ${result}`);
    assert(result.includes('已打开') || result.includes('IDE'), '项目应打开成功');
  });

  // 等待 IDE 启动稳定
  console.log('\n  ⏳ 等待 IDE 启动 (3s)...');
  await new Promise(r => setTimeout(r, 3000));

  // ========== Step 3: 检查登录状态 ==========
  await describe('islogin（检查登录）', async () => {
    const result = await run('islogin');
    console.log(`    ${result}`);

    const isLoggedIn = result.includes('已登录');
    assert(typeof result === 'string', '应返回登录状态');

    if (isLoggedIn) {
      console.log('\n  ✅ 已登录，跳过登录步骤');
    } else if (skipLogin) {
      console.log('\n  ⏭️  未登录，但 --skip-login 已指定，跳过');
    } else {
      // 未登录 → 显示二维码
      console.log('\n  🔐 未登录，唤起二维码...');
      console.log('  请使用微信扫描下方二维码：\n');

      // 直接调用 CLI login（inherit 模式，二维码显示在终端）
      const cliPath = findCliPath(ctx);
      const loginResult = spawnSync(cliPath, ['login', '--qr-format', 'terminal'], {
        stdio: 'inherit',
        timeout: 180000,
      });

      if (loginResult.status === 0) {
        console.log('');
        // 再次验证
        const verifyResult = await run('islogin');
        const verified = verifyResult.includes('已登录');
        assert(verified, '扫码后应已登录');
      } else {
        assert(false, `登录失败 (退出码: ${loginResult.status})`);
      }
    }
  });

  // ========== Step 4: 启用自动化 ==========
  await describe('auto（启用自动化）', async () => {
    const result = await run('auto', { project: DEMO_PROJECT_PATH, autoPort: 9420 });
    console.log(`    ${result}`);
    assert(
      result.includes('已启用') || result.includes('auto'),
      '自动化应启用成功'
    );
  });

  // ========== 汇总 ==========
  const ok = summary();

  if (ok) {
    console.log('');
    console.log('🎉 IDE 已就绪！现在可以：');
    console.log(`   npm start`);
    console.log(`   wx> open --project ${DEMO_PROJECT_PATH}`);
    console.log('');
  }

  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error(`❌ 测试异常: ${e.message}`);
  process.exit(1);
});

/**
 * 测试: 连接管理
 * open, status, reconnect, close
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 连接管理命令');
  console.log(`   项目路径: ${DEMO_PROJECT_PATH}`);

  await describe('open', async () => {
    const result = await run('open', { project: DEMO_PROJECT_PATH });
    assert(result.includes('连接成功'), 'open 应连接成功');
    assert(ctx.miniProgram !== null, '应有 miniProgram 实例');
    assert(ctx.currentPage !== null, '应有 currentPage');
    console.log(`    ${result.split('\n')[1] || ''}`);
  });

  await describe('status', async () => {
    const result = await run('status', { refresh: true });
    assert(result.includes('已连接'), '应显示已连接状态');
    assert(result.includes('Console 监听'), '应显示 Console 监听状态');
  });

  await describe('reconnect', async () => {
    const result = await run('reconnect', {});
    assert(result.includes('连接成功'), 'reconnect 应成功');
  });

  await describe('close', async () => {
    const result = await run('close', {});
    assert(result.includes('已断开'), '应断开成功');
    assert(ctx.miniProgram === null, 'miniProgram 应为 null');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

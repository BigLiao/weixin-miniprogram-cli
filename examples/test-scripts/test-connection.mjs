/**
 * 测试: 连接管理
 * open, launch, status, close
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 连接管理命令');
  console.log(`   项目路径: ${DEMO_PROJECT_PATH}`);

  await describe('open', async () => {
    const result = await run('open', { project: DEMO_PROJECT_PATH });
    assert(result.includes('项目已打开'), 'open 应成功打开项目');
    assert(ctx.projectPath === DEMO_PROJECT_PATH, 'session 应绑定项目路径');
    assert(ctx.miniProgram === null, 'open 后不应直接建立 automator 连接');
    console.log(`    ${result.split('\n')[1] || ''}`);
  });

  await describe('status', async () => {
    const result = await run('status', { refresh: true });
    assert(result.includes('opened'), '应显示 opened 状态');
  });

  await describe('launch', async () => {
    const result = await run('launch', { autoPort: 9420 });
    assert(result.includes('连接成功') || result.includes('automator 已启动'), 'launch 应成功连接');
    assert(ctx.miniProgram !== null, 'launch 后应有 miniProgram 实例');
    assert(ctx.currentPage !== null, 'launch 后应有 currentPage');
  });

  await describe('status (connected)', async () => {
    const result = await run('status', { refresh: true });
    assert(result.includes('connected'), '应显示 connected 状态');
    assert(result.includes('Console 监听'), '应显示 Console 监听状态');
  });

  await describe('close', async () => {
    const result = await run('close', {});
    assert(result.includes('session 已关闭并销毁'), '应关闭并清理成功');
    assert(ctx.miniProgram === null, 'miniProgram 应为 null');
    assert(ctx.projectPath === null, 'projectPath 应被清空');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

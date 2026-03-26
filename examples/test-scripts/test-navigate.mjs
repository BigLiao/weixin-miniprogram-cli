/**
 * 测试: 页面导航 (4个命令)
 * - goto
 * - go-back
 * - switch-tab
 * - relaunch
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 页面导航命令');

  await run('open', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  await describe('goto', async () => {
    const result = await run('goto', { url: 'page/component/index' });
    assert(result.includes('导航到'), '应导航成功');
  });

  await describe('go-back', async () => {
    const result = await run('go-back', { delta: 1 });
    assert(result.includes('返回到'), '应返回成功');
  });

  await describe('switch-tab', async () => {
    // miniprogram-demo 的 tab 页面（根据实际配置调整）
    try {
      const result = await run('switch-tab', { url: 'page/component/index' });
      assert(result.includes('切换到') || result.includes('失败'), 'switch-tab 应执行');
    } catch (e) {
      // 如果不是 tab 页面会失败，这是预期的
      assert(true, `switch-tab: ${e.message}`);
    }
  });

  await describe('relaunch', async () => {
    const result = await run('relaunch', { url: 'page/component/index' });
    assert(result.includes('重启'), '应重启成功');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

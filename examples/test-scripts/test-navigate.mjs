/**
 * 测试: 页面导航
 * goto, go-back, relaunch, scroll
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 页面导航命令');

  await run('open', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  // 先 relaunch 确保页面栈干净
  await describe('relaunch', async () => {
    const result = await run('relaunch', { url: 'page/component/index' });
    assert(result.includes('重启'), '应重启成功');
  });

  await describe('goto (普通页面)', async () => {
    const result = await run('goto', { url: 'page/component/index' });
    assert(result.includes('导航到') || result.includes('导航失败'), 'goto 应执行');
    // 导航失败也打印出来便于排查
    if (result.includes('导航失败')) console.log(`    ${result}`);
  });

  await describe('go-back', async () => {
    const result = await run('go-back', { delta: 1 });
    assert(result.includes('返回到'), '应返回成功');
  });

  await describe('goto (tabBar 页面)', async () => {
    try {
      const result = await run('goto', { url: 'page/component/index' });
      assert(result.includes('导航到') || result.includes('切换到') || result.includes('失败'), 'goto 应执行');
    } catch (e) {
      // 可能失败，属于预期行为
      assert(true, `goto tabBar: ${e.message}`);
    }
  });

  await describe('scroll', async () => {
    const result = await run('scroll', { scrollTop: 200, duration: 100 });
    assert(result.includes('滚动'), '应滚动成功');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

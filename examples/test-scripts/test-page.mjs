/**
 * 测试: 页面查询 + 快照
 * page, snapshot, query, wait
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 页面查询 + 快照命令');

  // 前置：连接
  await run('open', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  await describe('page', async () => {
    const result = await run('page', {});
    assert(result.includes('当前页面'), '应返回当前页面信息');
    assert(ctx.currentPage !== null, 'currentPage 应已设置');
  });

  await describe('snapshot', async () => {
    const result = await run('snapshot', { format: 'compact' });
    assert(result.includes('快照获取成功'), '应获取快照成功');
    assert(ctx.elementMap.size > 0, '应有元素映射');
    console.log(`    元素数量: ${ctx.elementMap.size}`);
  });

  await describe('query', async () => {
    const result = await run('query', { selector: 'view' });
    assert(result.includes('找到元素'), '应找到 view 元素');
  });

  await describe('wait (delay)', async () => {
    const start = Date.now();
    const result = await run('wait', { delay: 500 });
    const elapsed = Date.now() - start;
    assert(result.includes('等待') && result.includes('完成'), '延时等待应完成');
    assert(elapsed >= 450, '应至少等待 ~500ms');
  });

  await describe('wait (selector)', async () => {
    const result = await run('wait', { selector: 'view', timeout: 3000 });
    assert(result.includes('已出现'), 'view 元素应存在');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

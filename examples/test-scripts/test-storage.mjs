/**
 * 测试: 本地存储
 * storage (list, set, get, remove, clear)
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 本地存储命令');

  await run('open', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  await describe('storage set', async () => {
    const result = await run('storage', { action: 'set', key: '__test_key__', value: '"hello"' });
    assert(result.includes('已设置') || result.includes('set'), '应设置成功');
  });

  await describe('storage get', async () => {
    const result = await run('storage', { action: 'get', key: '__test_key__' });
    assert(result.includes('hello'), '应读取到设置的值');
  });

  await describe('storage list', async () => {
    const result = await run('storage', { action: 'list' });
    assert(typeof result === 'string', '应返回存储列表');
  });

  await describe('storage remove', async () => {
    const result = await run('storage', { action: 'remove', key: '__test_key__' });
    assert(result.includes('已删除') || result.includes('remove'), '应删除成功');
  });

  await describe('storage clear', async () => {
    const result = await run('storage', { action: 'clear' });
    assert(result.includes('已清空') || result.includes('clear'), '应清空成功');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

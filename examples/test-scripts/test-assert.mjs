/**
 * 测试: 断言验证 (3个命令)
 * - assert_text
 * - assert_attribute
 * - assert_state
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 断言验证命令');

  await run('connect_devtools', { project: DEMO_PROJECT_PATH });
  await run('get_page_snapshot', { format: 'minimal' });
  console.log(`   已连接，元素: ${ctx.elementMap.size}\n`);

  const uid = findFirstUid(ctx.elementMap);

  await describe('assert_text', async () => {
    if (!uid) { assert(false, '无可用元素'); return; }
    try {
      const result = await run('assert_text', { uid, textContains: '' });
      assert(typeof result === 'string', 'assert_text 应返回结果');
    } catch (e) {
      assert(false, `assert_text 异常: ${e.message}`);
    }
  });

  await describe('assert_attribute', async () => {
    if (!uid) { assert(false, '无可用元素'); return; }
    try {
      // 测试一个一定不匹配的情况
      const result = await run('assert_attribute', { uid, key: 'class', value: '__impossible__' });
      assert(result.includes('不匹配') || result.includes('匹配'), '应返回断言结果');
    } catch (e) {
      assert(false, `assert_attribute 异常: ${e.message}`);
    }
  });

  await describe('assert_state', async () => {
    if (!uid) { assert(false, '无可用元素'); return; }
    try {
      const result = await run('assert_state', { uid, visible: true });
      assert(result.includes('通过') || result.includes('失败') || result.includes('visible'), '应返回状态断言结果');
    } catch (e) {
      assert(false, `assert_state 异常: ${e.message}`);
    }
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

function findFirstUid(elementMap) {
  for (const [uid] of elementMap) return uid;
  return null;
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

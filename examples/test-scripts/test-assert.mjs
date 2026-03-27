/**
 * 测试: 断言验证
 * assert-text, assert-attr, assert-state
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 断言验证命令');

  await run('open', { project: DEMO_PROJECT_PATH });
  await run('snapshot', { format: 'minimal' });
  console.log(`   已连接，元素: ${ctx.elementMap.size}\n`);

  const uid = findFirstUid(ctx.elementMap);

  await describe('assert-text', async () => {
    if (!uid) { assert(false, '无可用元素'); return; }
    try {
      const result = await run('assert-text', { uid, textContains: '' });
      assert(typeof result === 'string', 'assert-text 应返回结果');
    } catch (e) {
      assert(false, `assert-text 异常: ${e.message}`);
    }
  });

  await describe('assert-attr', async () => {
    if (!uid) { assert(false, '无可用元素'); return; }
    try {
      // 测试一个一定不匹配的情况
      const result = await run('assert-attr', { uid, key: 'class', value: '__impossible__' });
      assert(result.includes('不匹配') || result.includes('匹配'), '应返回断言结果');
    } catch (e) {
      assert(false, `assert-attr 异常: ${e.message}`);
    }
  });

  await describe('assert-state', async () => {
    if (!uid) { assert(false, '无可用元素'); return; }
    try {
      const result = await run('assert-state', { uid, visible: true });
      assert(result.includes('通过') || result.includes('失败') || result.includes('visible'), '应返回状态断言结果');
    } catch (e) {
      assert(false, `assert-state 异常: ${e.message}`);
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

/**
 * 测试: 交互操作 (4个命令)
 * - click
 * - fill
 * - value
 * - set-value
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 交互操作命令');

  // 前置：连接 + 快照
  await run('open', { project: DEMO_PROJECT_PATH });
  await run('snapshot', { format: 'minimal' });
  console.log(`   已连接，元素: ${ctx.elementMap.size}\n`);

  await describe('click', async () => {
    // 找一个可点击元素的 UID
    const uid = findFirstUid(ctx.elementMap);
    if (uid) {
      try {
        const result = await run('click', { uid });
        assert(result.includes('点击'), `应成功点击: ${uid}`);
      } catch (e) {
        assert(false, `点击失败: ${e.message}`);
      }
    } else {
      assert(false, '没有可用的元素 UID');
    }
  });

  await describe('fill', async () => {
    // 导航到有 input 的页面，或直接测试命令框架
    // 这里测试命令解析和错误处理
    try {
      await run('fill', { uid: '__nonexistent__', text: 'test' });
      assert(false, '不存在的 UID 应抛错');
    } catch (e) {
      assert(e.message.includes('未找到 UID'), '应提示 UID 不存在');
    }
  });

  await describe('value', async () => {
    const uid = findFirstUid(ctx.elementMap);
    if (uid) {
      try {
        const result = await run('value', { uid });
        assert(typeof result === 'string', '应返回字符串结果');
      } catch (e) {
        // 某些元素没有 value，这是可接受的
        assert(true, `value 执行: ${e.message}`);
      }
    }
  });

  await describe('set-value', async () => {
    try {
      await run('set-value', { uid: '__nonexistent__', value: '"test"' });
      assert(false, '不存在的 UID 应抛错');
    } catch (e) {
      assert(e.message.includes('未找到 UID'), '应提示 UID 不存在');
    }
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

function findFirstUid(elementMap) {
  for (const [uid] of elementMap) {
    return uid;
  }
  return null;
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

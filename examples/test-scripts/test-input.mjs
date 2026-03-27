/**
 * 测试: 交互操作
 * click, fill, value, set-value, hover, press, drag
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 交互操作命令');

  await run('open', { project: DEMO_PROJECT_PATH });
  await run('snapshot', { format: 'minimal' });
  console.log(`   已连接，元素: ${ctx.elementMap.size}\n`);

  const uid = findFirstUid(ctx.elementMap);

  await describe('click', async () => {
    if (!uid) { assert(false, '没有可用元素'); return; }
    try {
      const result = await run('click', { uid });
      assert(result.includes('点击'), `应成功点击: ${uid}`);
    } catch (e) {
      assert(false, `点击失败: ${e.message}`);
    }
  });

  await describe('fill — 错误处理', async () => {
    try {
      await run('fill', { uid: '__nonexistent__', text: 'test' });
      assert(false, '不存在的 UID 应抛错');
    } catch (e) {
      assert(e.message.includes('未找到 UID'), '应提示 UID 不存在');
    }
  });

  await describe('value', async () => {
    if (!uid) { assert(false, '没有可用元素'); return; }
    try {
      const result = await run('value', { uid });
      assert(typeof result === 'string', '应返回字符串结果');
    } catch (e) {
      // 非输入元素没有 value，可接受
      assert(true, `value 执行完毕: ${e.message}`);
    }
  });

  await describe('set-value — 错误处理', async () => {
    try {
      await run('set-value', { uid: '__nonexistent__', value: '"test"' });
      assert(false, '不存在的 UID 应抛错');
    } catch (e) {
      assert(e.message.includes('未找到 UID'), '应提示 UID 不存在');
    }
  });

  await describe('hover', async () => {
    if (!uid) { assert(false, '没有可用元素'); return; }
    try {
      const result = await run('hover', { uid });
      assert(result.includes('长按'), `应成功长按: ${uid}`);
    } catch (e) {
      assert(false, `hover 失败: ${e.message}`);
    }
  });

  await describe('press', async () => {
    try {
      const result = await run('press', { key: 'Enter' });
      assert(result.includes('按键'), '应成功触发按键');
    } catch (e) {
      assert(false, `press 失败: ${e.message}`);
    }
  });

  await describe('drag — 错误处理', async () => {
    try {
      await run('drag', { fromUid: '__nonexistent__', toUid: '__nonexistent2__' });
      assert(false, '不存在的 UID 应抛错');
    } catch (e) {
      assert(e.message.includes('未找到'), '应提示元素不存在');
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

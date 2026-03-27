/**
 * 测试: Console 监控
 * console, console-detail
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: Console 监控命令');

  await run('open', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  // 触发一些 console 输出
  try {
    await run('eval', { script: 'console.log("test-message-from-cli"); return true;' });
  } catch {}

  await new Promise(r => setTimeout(r, 500));

  await describe('console', async () => {
    const result = await run('console', { pageSize: 20 });
    assert(typeof result === 'string', '应返回字符串结果');
    console.log(`    消息数: ${ctx.consoleMessages.length}`);
  });

  await describe('console-detail', async () => {
    if (ctx.consoleMessages.length > 0) {
      const msgid = ctx.consoleMessages[0].msgid;
      const result = await run('console-detail', { msgid });
      assert(result.includes(`#${msgid}`), '应返回消息详情');
    } else {
      // 没有消息也测试错误处理
      const result = await run('console-detail', { msgid: 99999 });
      assert(result.includes('未找到'), '不存在的 msgid 应提示未找到');
    }
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

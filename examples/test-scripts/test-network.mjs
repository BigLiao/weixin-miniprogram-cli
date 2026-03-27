/**
 * 测试: 网络监控
 * network, network-detail, network-clear, network-stop
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 网络监控命令');

  await run('open', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  await describe('network', async () => {
    const result = await run('network', { pageSize: 20 });
    assert(typeof result === 'string', '应返回字符串结果');
    console.log(`    请求数: ${ctx.networkRequests.length}`);
  });

  await describe('network-detail', async () => {
    if (ctx.networkRequests.length > 0) {
      const reqid = ctx.networkRequests[0].reqid;
      const result = await run('network-detail', { reqid });
      assert(result.includes(`#${reqid}`), '应返回请求详情');
    } else {
      const result = await run('network-detail', { reqid: 'req_99999' });
      assert(result.includes('未找到'), '不存在的 reqid 应提示未找到');
    }
  });

  await describe('network-clear', async () => {
    const result = await run('network-clear', { clearRemote: true });
    assert(result.includes('已清除'), '应清除成功');
    assert(ctx.networkRequests.length === 0, '请求列表应为空');
  });

  await describe('network-stop', async () => {
    const result = await run('network-stop', { clearLogs: false });
    assert(result.includes('已停止') || result.includes('未运行'), '应停止或提示未运行');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

/**
 * 测试: 网络监控 (4个命令)
 * - list_network_requests
 * - get_network_request
 * - clear_network_requests
 * - stop_network_monitoring
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 网络监控命令');

  await run('connect_devtools', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  await describe('list_network_requests', async () => {
    const result = await run('list_network_requests', { pageSize: 20 });
    assert(typeof result === 'string', '应返回字符串结果');
    console.log(`    请求数: ${ctx.networkRequests.length}`);
  });

  await describe('get_network_request', async () => {
    if (ctx.networkRequests.length > 0) {
      const reqid = ctx.networkRequests[0].reqid;
      const result = await run('get_network_request', { reqid });
      assert(result.includes(`#${reqid}`), '应返回请求详情');
    } else {
      const result = await run('get_network_request', { reqid: 'req_99999' });
      assert(result.includes('未找到'), '不存在的 reqid 应提示未找到');
    }
  });

  await describe('clear_network_requests', async () => {
    const result = await run('clear_network_requests', { clearRemote: true });
    assert(result.includes('已清除'), '应清除成功');
    assert(ctx.networkRequests.length === 0, '请求列表应为空');
  });

  await describe('stop_network_monitoring', async () => {
    const result = await run('stop_network_monitoring', { clearLogs: false });
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

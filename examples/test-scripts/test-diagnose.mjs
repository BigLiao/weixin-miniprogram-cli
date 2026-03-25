/**
 * 测试: 诊断工具 (4个命令)
 * - check_environment
 * - diagnose_connection
 * - debug_page_elements
 * - debug_connection_flow
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: 诊断工具命令');

  await describe('check_environment', async () => {
    const result = await run('check_environment', {});
    assert(result.includes('环境检查'), '应返回环境检查结果');
    assert(result.includes('Node.js'), '应包含 Node.js 信息');
  });

  await describe('diagnose_connection', async () => {
    const result = await run('diagnose_connection', { project: DEMO_PROJECT_PATH });
    assert(result.includes('连接诊断'), '应返回诊断结果');
    assert(result.includes('项目路径'), '应检查项目路径');
  });

  // 以下需要连接
  await run('connect_devtools', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  await describe('debug_page_elements', async () => {
    const result = await run('debug_page_elements', { testAllStrategies: true });
    assert(result.includes('页面元素调试'), '应返回调试结果');
  });

  await describe('debug_connection_flow (dry-run)', async () => {
    // 断开后用 dry-run 测试
    await run('disconnect_devtools', {});
    const result = await run('debug_connection_flow', {
      project: DEMO_PROJECT_PATH,
      mode: 'auto',
      dryRun: true,
      verbose: true,
    });
    assert(result.includes('连接流程调试'), '应返回流程调试结果');
    assert(result.includes('步骤'), '应包含步骤信息');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

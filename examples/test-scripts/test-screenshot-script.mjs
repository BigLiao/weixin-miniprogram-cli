/**
 * 测试: 截图 + 脚本执行 (2个命令)
 * - screenshot
 * - eval
 */

import { run, assert, describe, summary, cleanup, ctx, DEMO_PROJECT_PATH } from './test-utils.mjs';
import { existsSync, unlinkSync } from 'fs';

async function main() {
  console.log('🔧 测试: 截图 + 脚本执行命令');

  await run('open', { project: DEMO_PROJECT_PATH });
  console.log('   已连接\n');

  await describe('screenshot', async () => {
    const path = '/tmp/mp-cli-test-screenshot.png';
    try { unlinkSync(path); } catch {}

    const result = await run('screenshot', { path });
    assert(result.includes('截图已保存'), '应保存截图');
    assert(existsSync(path), '截图文件应存在');

    // 清理
    try { unlinkSync(path); } catch {}
  });

  await describe('eval', async () => {
    const result = await run('eval', { script: 'return 1 + 1;' });
    assert(result.includes('2') || result.includes('执行'), '应返回执行结果');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

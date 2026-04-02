/**
 * 测试: doctor 命令
 */

import { run, assert, describe, summary, cleanup } from './test-utils.mjs';

async function main() {
  console.log('🔧 测试: doctor 命令');

  await describe('doctor', async () => {
    const result = await run('doctor', {});
    assert(result.includes('Node.js'), '应包含 Node.js 信息');
    assert(result.includes('运行环境'), '应包含运行环境段');
    assert(result.includes('微信开发者工具'), '应包含开发者工具段');
    assert(result.includes('Daemon'), '应包含 Daemon 段');
  });

  const ok = summary();
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 测试异常:', e.message);
  cleanup().then(() => process.exit(1));
});

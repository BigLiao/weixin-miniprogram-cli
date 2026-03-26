/**
 * 测试: miniprogram-automator SDK API 返回结果
 *
 * 启动小程序项目，依次测试 SDK 各 API 的返回值。
 *
 * 用法:
 *   node examples/test-scripts/test-sdk-api.mjs
 */

import automator from 'miniprogram-automator';

const PROJECT_PATH = '/Users/liao/work/zhiji/xiaoyue_miniapp';

async function main() {
  console.log('🚀 启动小程序项目...');
  console.log(`   项目路径: ${PROJECT_PATH}\n`);

  const miniProgram = await automator.launch({ projectPath: PROJECT_PATH });
  console.log('✅ 启动成功\n');

  try {
    // 导航到目标页面
    const page = await miniProgram.navigateTo('/activities/cfer/main');
    await new Promise(r => setTimeout(r, 5000)); // 等待页面渲染

    console.log('📄 当前页面:', page.path);

    // 获取 page 根元素
    const pageEl = await page.$('page');


    


    const wxml = await pageEl.wxml();
    console.log('  type:', typeof wxml);
    console.log('  length:', wxml?.length);
    console.log(wxml);

    // outerWxml()
    console.log('\n🔹 page.$("page").outerWxml()');
    const outerWxml = await pageEl.outerWxml();
    console.log('  type:', typeof outerWxml);
    console.log('  length:', outerWxml?.length);
    console.log(outerWxml);
  } finally {
    await miniProgram.disconnect();
    console.log('\n👋 已断开');
  }
}

main().catch(e => {
  console.error('❌ 启动失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});

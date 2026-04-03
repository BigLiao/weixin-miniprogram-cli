/**
 * automator-eval 命令
 * 在 Node.js daemon 进程中执行 automator SDK 脚本
 * 与 eval 不同：eval 在小程序 wx 沙箱内求值，automator-eval 在 Node 端执行 automator SDK 代码
 */

import fs from 'node:fs';
import path from 'node:path';
import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const automatorEval: CommandDef = defineCommand({
  name: 'automator-eval',
  description: '调用 automator SDK 底层方法（当其他命令不满足需求时使用）',
  longDescription:
    '在 Node.js daemon 进程中执行脚本，直接操作 automator SDK 对象。\n' +
    '脚本中可使用 miniProgram 和 page 两个预置变量，支持 await。\n' +
    '与 eval 的区别：eval 在小程序 wx 沙箱内执行，只能访问 wx.* API；\n' +
    'automator-eval 在 Node 端执行，可调用 miniProgram / page 的所有方法。',
  category: '脚本执行',
  args: [
    { name: 'script', type: 'string', required: false, description: '要执行的 automator SDK 代码（与 --file 二选一）' },
    { name: 'file', type: 'string', required: false, description: '脚本文件路径（优先于 script 参数）' },
  ],
  examples: [
    { cmd: 'automator-eval "return await page.path"', desc: '获取当前页面路径' },
    { cmd: 'automator-eval "return await page.data()"', desc: '获取当前页面 data' },
    { cmd: 'automator-eval "await miniProgram.navigateTo({ url: \'/pages/index/index\' })"', desc: '导航到指定页面' },
    { cmd: 'automator-eval "const el = await page.$(\'.btn\'); await el.tap()"', desc: '点击页面元素' },
    { cmd: 'automator-eval --file ./test-flow.js', desc: '执行脚本文件' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    // 确定脚本内容：file 优先
    let scriptContent: string;
    if (args.file) {
      const filePath = path.resolve(args.file);
      if (!fs.existsSync(filePath)) {
        return out.error(`文件不存在: ${filePath}`);
      }
      scriptContent = fs.readFileSync(filePath, 'utf-8');
    } else if (args.script) {
      scriptContent = args.script;
    } else {
      return out.error('请提供 script 参数或 --file 参数');
    }

    try {
      // 使用 AsyncFunction 构造器，让脚本中可以直接使用 await
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      let fn: (...args: any[]) => Promise<any>;
      try {
        fn = new AsyncFunction('miniProgram', 'page', scriptContent);
      } catch (syntaxErr: any) {
        return out.error(`脚本语法错误: ${syntaxErr.message}`);
      }

      const miniProgram = ctx.miniProgram!;
      const page = await miniProgram.currentPage();
      const result = await fn(miniProgram, page);

      if (result === undefined || result === null) {
        return out.success('执行完成 (无返回值)');
      }

      return out.success('执行结果:') + '\n' + out.prettyJson(result);
    } catch (e: any) {
      // 提取脚本内的堆栈行号（anonymous 函数内的行号即脚本行号）
      const stack = (e.stack || '').split('\n')
        .filter((line: string) => line.includes('<anonymous>') || line.includes('evalmachine'))
        .map((line: string) => line.trim())
        .join('\n');
      const detail = stack ? `\n${out.dim(stack)}` : '';
      return out.error(`执行失败: ${e.message}${detail}`);
    }
  },
});

export const automatorEvalCommands: CommandDef[] = [
  automatorEval,
];

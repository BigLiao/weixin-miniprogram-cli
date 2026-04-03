/**
 * 脚本执行命令 (1个)
 * eval
 */

import * as fs from 'fs';
import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const evaluateScript: CommandDef = defineCommand({
  name: 'eval',
  description: '在小程序中执行 JavaScript 代码（支持内联代码或脚本文件）',
  category: '脚本执行',
  args: [
    { name: 'code', type: 'string', description: '要执行的 JavaScript 代码（内联）', alias: 'c' },
    { name: 'script', type: 'string', description: '要执行的 JavaScript 文件路径', alias: 's' },
  ],
  examples: [
    'eval "return 1 + 1"',
    'eval "return wx.getSystemInfoSync()"',
    'eval --code "return getCurrentPages().map(p => p.route)"',
    'eval --script ./test.js',
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    // 确定要执行的代码：--code 或 --script（文件）
    let code: string | undefined = args.code;

    if (args.script) {
      // 从文件读取
      const filePath = args.script;
      try {
        code = fs.readFileSync(filePath, 'utf-8');
      } catch (e: any) {
        return out.error(`读取脚本文件失败: ${filePath}\n  ${e.message}`);
      }
    }

    if (!code) {
      return out.error('请指定要执行的代码: eval "代码" 或 eval --script <文件路径>');
    }

    try {
      // miniProgram.evaluate 接受函数，但我们需要执行用户提供的字符串
      // 构造一个 Function 来执行
      const wrappedScript = `return (function() { ${code} })()`;
      const fn = new Function(wrappedScript);
      const result = await ctx.miniProgram!.evaluate(fn);

      if (result === undefined || result === null) {
        return out.success('执行完成 (无返回值)');
      }

      return out.success('执行结果:') + '\n' + out.prettyJson(result);
    } catch (e: any) {
      return out.error(`执行失败: ${e.message}`);
    }
  },
});

export const scriptCommands: CommandDef[] = [
  evaluateScript,
];

/**
 * 脚本执行命令 (1个)
 * evaluate_script
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const evaluateScript: CommandDef = defineCommand({
  name: 'evaluate_script',
  description: '在小程序中执行 JavaScript 代码',
  category: '脚本执行',
  args: [
    { name: 'script', type: 'string', required: true, description: '要执行的 JavaScript 代码' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    try {
      // miniProgram.evaluate 接受函数，但我们需要执行用户提供的字符串
      // 构造一个 Function 来执行
      const wrappedScript = `return (function() { ${args.script} })()`;
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

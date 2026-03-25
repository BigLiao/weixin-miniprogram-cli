/**
 * 脚本执行命令 (1个)
 * evaluate_script
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const evaluateScript: CommandDef = defineCommand({
  name: 'evaluate_script',
  description: '在小程序页面中执行 JavaScript 代码',
  category: '脚本执行',
  args: [
    { name: 'script', type: 'string', required: true, description: '要执行的 JavaScript 代码' },
    { name: 'params', type: 'json', description: '传递给脚本的参数 (JSON)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();

    try {
      const fn = args.params
        ? `(params) => { ${args.script} }`
        : `() => { ${args.script} }`;

      const result = await ctx.currentPage!.callFunction(fn, args.params);

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

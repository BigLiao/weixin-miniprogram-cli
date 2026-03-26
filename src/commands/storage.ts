/**
 * Storage 管理命令 (1个)
 * storage
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const storage: CommandDef = defineCommand({
  name: 'storage',
  description: '管理小程序本地存储（get/set/remove/clear/list）',
  category: '数据管理',
  args: [
    { name: 'action', type: 'string', required: true, description: '操作: get|set|remove|clear|list' },
    { name: 'key', type: 'string', description: '存储键名（get/set/remove 时必填）' },
    { name: 'value', type: 'json', description: '要设置的值（set 时必填，支持 JSON）' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    const action = args.action;

    switch (action) {
      case 'get': {
        if (!args.key) return out.error('get 操作需要 --key 参数');
        const result = await ctx.miniProgram!.evaluate((key: string) => {
          // @ts-ignore
          return wx.getStorageSync(key);
        }, args.key);
        if (result === undefined || result === null || result === '') {
          return out.warn(`key "${args.key}" 不存在或为空`);
        }
        return `${args.key} = ${out.prettyJson(result)}`;
      }

      case 'set': {
        if (!args.key) return out.error('set 操作需要 --key 参数');
        if (args.value === undefined) return out.error('set 操作需要 --value 参数');
        await ctx.miniProgram!.evaluate((params: { key: string; value: any }) => {
          // @ts-ignore
          wx.setStorageSync(params.key, params.value);
        }, { key: args.key, value: args.value });
        return out.success(`已设置: ${args.key} = ${JSON.stringify(args.value)}`);
      }

      case 'remove': {
        if (!args.key) return out.error('remove 操作需要 --key 参数');
        await ctx.miniProgram!.evaluate((key: string) => {
          // @ts-ignore
          wx.removeStorageSync(key);
        }, args.key);
        return out.success(`已删除: ${args.key}`);
      }

      case 'clear': {
        await ctx.miniProgram!.evaluate(() => {
          // @ts-ignore
          wx.clearStorageSync();
        });
        return out.success('已清空所有本地存储');
      }

      case 'list': {
        const info = await ctx.miniProgram!.evaluate(() => {
          // @ts-ignore
          const res = wx.getStorageInfoSync();
          return {
            keys: res.keys || [],
            currentSize: res.currentSize || 0,
            limitSize: res.limitSize || 0,
          };
        });

        const lines: string[] = [];
        lines.push(out.info(`本地存储 (${info.currentSize}KB / ${info.limitSize}KB)`));
        if (info.keys.length === 0) {
          lines.push(out.dim('  (空)'));
        } else {
          for (const key of info.keys) {
            lines.push(`  ${key}`);
          }
          lines.push('');
          lines.push(out.dim(`  共 ${info.keys.length} 个键`));
        }
        return lines.join('\n');
      }

      default:
        return out.error(`未知操作: ${action}。支持: get, set, remove, clear, list`);
    }
  },
});

export const storageCommands: CommandDef[] = [
  storage,
];

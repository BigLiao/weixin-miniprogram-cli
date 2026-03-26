/**
 * 页面查询命令组 (3个)
 * page, query, wait
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const getCurrentPage: CommandDef = defineCommand({
  name: 'page',
  description: '获取当前页面信息并设为活动页面',
  category: '页面查询',
  args: [],
  handler: async (_args, ctx) => {
    ctx.ensureConnected();
    ctx.currentPage = await ctx.miniProgram!.currentPage();
    const path = ctx.currentPage?.path || 'unknown';
    const lines = [
      out.success(`当前页面: ${path}`),
    ];

    try {
      const data = await ctx.currentPage!.data();
      if (data && Object.keys(data).length > 0) {
        lines.push(`  页面数据: ${out.prettyJson(data).slice(0, 500)}`);
      }
    } catch {}

    return lines.join('\n');
  },
});

export const querySelector: CommandDef = defineCommand({
  name: 'query',
  description: '通过 CSS 选择器查找页面元素',
  category: '页面查询',
  args: [
    { name: 'selector', type: 'string', required: true, description: 'CSS 选择器 (如: view.container, #myId, .myClass)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();
    const el = await ctx.currentPage!.$(args.selector);

    if (!el) {
      return out.warn(`未找到匹配元素: ${args.selector}`);
    }

    const lines = [out.success(`找到元素: ${args.selector}`)];

    try {
      const tagName = el.tagName;
      lines.push(`  标签: ${tagName}`);
    } catch {}

    try {
      const text = await el.text();
      if (text) lines.push(`  文本: ${out.truncate(text)}`);
    } catch {}

    // 查找所有匹配
    try {
      const all = await ctx.currentPage!.$$(args.selector);
      if (all && all.length > 1) {
        lines.push(`  匹配数量: ${all.length} 个`);
      }
    } catch {}

    return lines.join('\n');
  },
});

export const waitFor: CommandDef = defineCommand({
  name: 'wait',
  description: '等待条件满足（时间、元素出现、文本匹配、可见性）',
  category: '页面查询',
  args: [
    { name: 'delay', type: 'number', description: '等待指定毫秒数' },
    { name: 'selector', type: 'string', description: 'CSS 选择器，等待元素出现' },
    { name: 'timeout', type: 'number', default: 5000, description: '超时时间(ms)' },
    { name: 'text', type: 'string', description: '等待包含指定文本的元素' },
    { name: 'visible', type: 'boolean', description: '等待元素可见/不可见' },
    { name: 'disappear', type: 'boolean', default: false, description: '等待元素消失' },
  ],
  handler: async (args, ctx) => {
    const startTime = Date.now();

    // 简单延时
    if (args.delay) {
      await new Promise(r => setTimeout(r, args.delay));
      return out.success(`等待 ${args.delay}ms 完成`);
    }

    if (!args.selector) {
      return out.error('请指定 --selector 或 --delay');
    }

    ctx.ensurePage();
    const timeout = args.timeout || 5000;
    const interval = 200;
    const deadline = startTime + timeout;

    while (Date.now() < deadline) {
      try {
        const el = await ctx.currentPage!.$(args.selector);

        if (args.disappear) {
          if (!el) {
            return out.success(`元素已消失: ${args.selector} (${Date.now() - startTime}ms)`);
          }
        } else {
          if (el) {
            // 检查文本条件
            if (args.text) {
              const text = await el.text();
              if (text && text.includes(args.text)) {
                return out.success(`文本匹配: "${args.text}" (${Date.now() - startTime}ms)`);
              }
            } else {
              return out.success(`元素已出现: ${args.selector} (${Date.now() - startTime}ms)`);
            }
          }
        }
      } catch {}

      await new Promise(r => setTimeout(r, interval));
    }

    return out.error(`等待超时 (${timeout}ms): ${args.selector}`);
  },
});

export const pageCommands: CommandDef[] = [
  getCurrentPage,
  querySelector,
  waitFor,
];

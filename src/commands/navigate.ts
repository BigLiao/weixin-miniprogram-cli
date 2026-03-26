/**
 * 页面导航命令组 (5个)
 * goto, go-back, switch-tab, relaunch, scroll
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const navigateTo: CommandDef = defineCommand({
  name: 'goto',
  description: '导航到指定页面',
  category: '页面导航',
  args: [
    { name: 'url', type: 'string', required: true, description: '目标页面路径' },
    { name: 'params', type: 'json', description: '查询参数 (JSON 对象)' },
    { name: 'redirect', type: 'boolean', default: false, description: '使用 redirect 模式（关闭当前页面）' },
    { name: 'waitForLoad', type: 'boolean', default: true, description: '等待页面加载完成' },
    { name: 'timeout', type: 'number', default: 10000, description: '等待超时(ms)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    let url = args.url;
    // 拼接查询参数
    if (args.params && typeof args.params === 'object') {
      const query = Object.entries(args.params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      url += (url.includes('?') ? '&' : '?') + query;
    }

    // 确保以 / 开头
    if (!url.startsWith('/')) url = '/' + url;

    try {
      let page: any;
      if (args.redirect) {
        page = await ctx.miniProgram!.redirectTo(url);
      } else {
        page = await ctx.miniProgram!.navigateTo(url);
      }
      ctx.currentPage = page || await ctx.miniProgram!.currentPage();
      ctx.elementMap.clear(); // 导航后清空元素映射

      return out.success(`导航到: ${ctx.currentPage?.path || url}${args.redirect ? ' (redirect)' : ''}`);
    } catch (e: any) {
      return out.error(`导航失败: ${e.message}`);
    }
  },
});

export const navigateBack: CommandDef = defineCommand({
  name: 'go-back',
  description: '返回上一页',
  category: '页面导航',
  args: [
    { name: 'delta', type: 'number', default: 1, description: '返回的页面层数' },
    { name: 'waitForLoad', type: 'boolean', default: true, description: '等待页面加载' },
    { name: 'timeout', type: 'number', default: 5000, description: '等待超时(ms)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    try {
      await ctx.miniProgram!.navigateBack({ delta: args.delta || 1 });
      ctx.currentPage = await ctx.miniProgram!.currentPage();
      ctx.elementMap.clear();

      return out.success(`返回到: ${ctx.currentPage?.path || 'unknown'}`);
    } catch (e: any) {
      return out.error(`返回失败: ${e.message}`);
    }
  },
});

export const switchTab: CommandDef = defineCommand({
  name: 'switch-tab',
  description: '切换到指定 Tab 页面',
  category: '页面导航',
  args: [
    { name: 'url', type: 'string', required: true, description: 'Tab 页面路径' },
    { name: 'waitForLoad', type: 'boolean', default: true, description: '等待页面加载' },
    { name: 'timeout', type: 'number', default: 5000, description: '等待超时(ms)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    let url = args.url;
    if (!url.startsWith('/')) url = '/' + url;

    try {
      await ctx.miniProgram!.switchTab(url);
      ctx.currentPage = await ctx.miniProgram!.currentPage();
      ctx.elementMap.clear();

      return out.success(`切换到 Tab: ${ctx.currentPage?.path || url}`);
    } catch (e: any) {
      return out.error(`切换 Tab 失败: ${e.message}`);
    }
  },
});

export const relaunch: CommandDef = defineCommand({
  name: 'relaunch',
  description: '重启小程序并导航到指定页面',
  category: '页面导航',
  args: [
    { name: 'url', type: 'string', required: true, description: '目标页面路径' },
    { name: 'params', type: 'json', description: '查询参数 (JSON 对象)' },
    { name: 'waitForLoad', type: 'boolean', default: true, description: '等待页面加载' },
    { name: 'timeout', type: 'number', default: 10000, description: '等待超时(ms)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    let url = args.url;
    if (args.params && typeof args.params === 'object') {
      const query = Object.entries(args.params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      url += (url.includes('?') ? '&' : '?') + query;
    }
    if (!url.startsWith('/')) url = '/' + url;

    try {
      await ctx.miniProgram!.reLaunch(url);
      ctx.currentPage = await ctx.miniProgram!.currentPage();
      ctx.elementMap.clear();
      ctx.consoleMessages = [];
      ctx.networkRequests = [];

      return out.success(`重启并导航到: ${ctx.currentPage?.path || url}`);
    } catch (e: any) {
      return out.error(`重启失败: ${e.message}`);
    }
  },
});

export const scroll: CommandDef = defineCommand({
  name: 'scroll',
  description: '滚动页面到指定位置',
  category: '页面导航',
  args: [
    { name: 'scrollTop', type: 'number', required: true, description: '滚动到的位置（px）' },
    { name: 'duration', type: 'number', default: 300, description: '滚动动画时长(ms)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    try {
      const scrollTop = args.scrollTop;
      const duration = args.duration || 300;

      await ctx.miniProgram!.evaluate(
        (params: { scrollTop: number; duration: number }) => {
          // @ts-ignore
          wx.pageScrollTo({
            scrollTop: params.scrollTop,
            duration: params.duration,
          });
        },
        { scrollTop, duration },
      );

      // 等待滚动动画完成
      await new Promise(r => setTimeout(r, duration + 100));

      return out.success(`滚动到: ${scrollTop}px`);
    } catch (e: any) {
      return out.error(`滚动失败: ${e.message}`);
    }
  },
});

export const navigateCommands: CommandDef[] = [
  navigateTo,
  navigateBack,
  switchTab,
  relaunch,
  scroll,
];

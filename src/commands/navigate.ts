/**
 * 页面导航命令组
 * goto, go-back, relaunch, scroll
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

/**
 * 标准化页面路径：去掉开头的 / 和结尾的 .html，去掉查询参数
 */
function normalizePath(url: string): string {
  return url.replace(/^\//, '').replace(/\.html$/, '').split('?')[0];
}

/**
 * 判断 url 是否为 tabBar 页面
 */
function isTabBarPage(url: string, ctx: any): boolean {
  if (!ctx.appTabBar?.list?.length) return false;
  const normalized = normalizePath(url);
  return ctx.appTabBar.list.some(
    (t: any) => t.pagePath === normalized
  );
}

/**
 * 拼接查询参数到 url
 */
function appendParams(url: string, params?: Record<string, any>): string {
  if (!params || typeof params !== 'object') return url;
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return url + (url.includes('?') ? '&' : '?') + query;
}

/**
 * 列出所有可跳转的页面（普通页面 + tabBar 页面）
 */
function formatAvailablePages(ctx: any, title: string = '可跳转的页面:'): string {
  const lines: string[] = [];
  const tabList = ctx.appTabBar?.list || [];
  const hasPages = ctx.appPages?.length > 0;
  const hasTabs = tabList.length > 0;

  if (!hasPages && !hasTabs) {
    lines.push(out.warn('暂无页面信息，请先 open 项目'));
    return lines.join('\n');
  }

  lines.push(out.info(title));
  for (const p of (ctx.appPages || [])) {
    lines.push(`  ${p}`);
  }
  for (const tab of tabList) {
    lines.push(`  ${tab.pagePath}${tab.text ? ` (Tab: ${tab.text})` : ' (Tab)'}`);
  }
  return lines.join('\n');
}

export const gotoPage: CommandDef = defineCommand({
  name: 'goto',
  description: '跳转到指定页面（自动识别 tabBar / 普通页面）',
  category: '页面导航',
  args: [
    { name: 'url', type: 'string', description: '目标页面路径（不传则列出所有可用页面）' },
    { name: 'params', type: 'json', description: '查询参数 (JSON 对象)' },
    { name: 'redirect', type: 'boolean', default: false, description: '使用 redirect 模式（关闭当前页面）' },
    { name: 'waitForLoad', type: 'boolean', default: true, description: '等待页面加载完成' },
    { name: 'timeout', type: 'number', default: 10000, description: '等待超时(ms)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    if (!args.url) {
      return formatAvailablePages(ctx);
    }

    let url = appendParams(args.url, args.params);
    if (!url.startsWith('/')) url = '/' + url;

    try {
      if (isTabBarPage(url, ctx)) {
        // tabBar 页面 → switchTab（不支持带参数）
        const tabUrl = '/' + normalizePath(url);
        await ctx.miniProgram!.switchTab(tabUrl);
        ctx.currentPage = await ctx.miniProgram!.currentPage();
        return out.success(`切换到 Tab: ${ctx.currentPage?.path || tabUrl}`);
      }

      // 普通页面 → navigateTo / redirectTo
      const page = args.redirect
        ? await ctx.miniProgram!.redirectTo(url)
        : await ctx.miniProgram!.navigateTo(url);
      ctx.currentPage = page || await ctx.miniProgram!.currentPage();

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

      return out.success(`返回到: ${ctx.currentPage?.path || 'unknown'}`);
    } catch (e: any) {
      return out.error(`返回失败: ${e.message}`);
    }
  },
});

export const relaunch: CommandDef = defineCommand({
  name: 'relaunch',
  description: '重启小程序并导航到指定页面',
  category: '页面导航',
  args: [
    { name: 'url', type: 'string', description: '目标页面路径（不传则列出所有可用页面）' },
    { name: 'params', type: 'json', description: '查询参数 (JSON 对象)' },
    { name: 'waitForLoad', type: 'boolean', default: true, description: '等待页面加载' },
    { name: 'timeout', type: 'number', default: 10000, description: '等待超时(ms)' },
  ],
  handler: async (args, ctx) => {
    ctx.ensureConnected();

    if (!args.url) {
      return formatAvailablePages(ctx, '可导航的页面:');
    }

    let url = appendParams(args.url, args.params);
    if (!url.startsWith('/')) url = '/' + url;

    try {
      await ctx.miniProgram!.reLaunch(url);
      ctx.currentPage = await ctx.miniProgram!.currentPage();
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
  gotoPage,
  navigateBack,
  relaunch,
  scroll,
];

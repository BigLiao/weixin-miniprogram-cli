/**
 * 连接管理命令组 (4个)
 * open, reconnect, close, status
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineCommand, type CommandDef } from '../registry.js';
import { SharedContext } from '../context.js';
import * as out from '../utils/output.js';

// @ts-ignore - miniprogram-automator 没有类型定义
import automator from 'miniprogram-automator';

/**
 * 校验小程序项目路径：检测 app.json 是否存在
 * @returns 错误信息，如果路径合法则返回 null
 */
function validateProjectPath(projectPath: string): string | null {
  const absPath = resolve(projectPath);
  if (!existsSync(absPath)) {
    return `路径不存在: ${absPath}`;
  }
  const projectConfig = join(absPath, 'project.config.json');
  if (!existsSync(projectConfig)) {
    return `该目录不是小程序项目根目录（未找到 project.config.json）: ${absPath}`;
  }
  return null;
}

/**
 * 启动 Console 和 Network 自动监听
 */
async function setupAutoMonitoring(ctx: SharedContext): Promise<string[]> {
  const logs: string[] = [];

  // 自动启动 Console 监听
  try {
    if (ctx.miniProgram && !ctx.consoleListening) {
      ctx.miniProgram.on('console', (msg: any) => {
        ctx.addConsoleMessage(msg.type || 'log', msg.args || [msg.text || '']);
      });
      ctx.miniProgram.on('exception', (err: any) => {
        ctx.addConsoleMessage('exception', [err.message || String(err)], err.stack);
      });
      ctx.consoleListening = true;
      logs.push('Console 监听已自动启动');
    }
  } catch (e: any) {
    logs.push(`Console 监听启动失败: ${e.message}`);
  }

  // 自动启动 Network 监听（通过 miniProgram.evaluate 注入拦截器）
  try {
    if (ctx.miniProgram && !ctx.networkListening) {
      await ctx.miniProgram.evaluate(function() {
        // @ts-ignore
        if (typeof wx === 'undefined' || wx.__networkIntercepted) return;
        // @ts-ignore
        wx.__networkIntercepted = true;
        // @ts-ignore
        wx.__networkLogs = wx.__networkLogs || [];

        // @ts-ignore
        const origRequest = wx.request;
        // @ts-ignore
        delete wx.request;
        // @ts-ignore
        Object.defineProperty(wx, 'request', {
          configurable: true,
          value: function(options: any) {
            const start = Date.now();
            const entry = {
              type: 'request',
              method: options.method || 'GET',
              url: options.url,
              requestData: options.data,
              requestHeader: options.header,
              timestamp: Date.now(),
              success: false,
              statusCode: 0,
              responseData: null,
              responseHeader: null,
              errMsg: '',
              duration: 0
            };
            // @ts-ignore
            wx.__networkLogs.push(entry);

            const origSuccess = options.success;
            const origFail = options.fail;
            options.success = function(res: any) {
              entry.statusCode = res.statusCode;
              entry.responseData = res.data;
              entry.responseHeader = res.header;
              entry.success = true;
              entry.duration = Date.now() - start;
              if (origSuccess) origSuccess.call(this, res);
            };
            options.fail = function(err: any) {
              entry.success = false;
              entry.errMsg = err.errMsg || String(err);
              entry.duration = Date.now() - start;
              if (origFail) origFail.call(this, err);
            };
            return origRequest.call(this, options);
          }
        });
      });
      ctx.networkListening = true;
      logs.push('Network 监听已自动启动');
    }
  } catch (e: any) {
    logs.push(`Network 监听启动失败: ${e.message}`);
  }

  return logs;
}

/**
 * 获取小程序路由信息（pages、tabBar）
 * 通过运行时 __wxConfig 读取 app.json 配置
 */
async function initAppInfo(ctx: SharedContext): Promise<string[]> {
  const lines: string[] = [];
  try {
    const config = await ctx.miniProgram!.evaluate(() => {
      return {
        // @ts-ignore
        pages: __wxConfig.pages || [],
        // @ts-ignore
        tabBar: __wxConfig.tabBar || null,
      };
    });

    // 存到 ctx 供后续命令使用
    ctx.appPages = config.pages || [];
    ctx.appTabBar = config.tabBar || null;

    // LLM 友好的极简输出
    lines.push(`[Pages] ${config.pages.join(', ')}`);

    if (config.tabBar?.list?.length) {
      const tabs = config.tabBar.list.map((t: any) => t.pagePath).join(', ');
      lines.push(`[TabBar] ${tabs}`);
    }

    // 当前页面
    const curPage = ctx.currentPage?.path || 'unknown';
    lines.push(`[Current] ${curPage}`);
  } catch (e: any) {
    lines.push(`[Init] 获取路由信息失败: ${e.message}`);
  }
  return lines;
}

export const connectDevtools: CommandDef = defineCommand({
  name: 'open',
  description: '连接到微信开发者工具（支持多种策略）',
  category: '连接管理',
  args: [
    { name: 'project', type: 'string', description: '小程序项目绝对路径', alias: 'p' },
    { name: 'strategy', type: 'string', default: 'auto', description: '连接策略: auto|launch|connect|wsEndpoint|browserUrl|discover', alias: 's' },
    { name: 'ws', type: 'string', description: 'WebSocket 端点 (ws://...)' },
    { name: 'cliPath', type: 'string', description: '微信开发者工具 CLI 路径' },
    { name: 'autoPort', type: 'number', description: '自动化监听端口' },
    { name: 'browserUrl', type: 'string', description: 'HTTP 调试 URL' },
    { name: 'timeout', type: 'number', default: 45000, description: '连接超时(ms)' },
    { name: 'verbose', type: 'boolean', default: false, description: '显示详细日志', alias: 'v' },
  ],
  handler: async (args, ctx) => {
    const startTime = Date.now();
    const lines: string[] = [];

    const strategy = args.strategy || 'auto';
    lines.push(out.info(`连接策略: ${strategy}`));

    try {
      let mp: any;

      if (args.ws) {
        // 直接 WebSocket 连接
        lines.push(out.dim(`连接到 ${args.ws}...`));
        mp = await automator.connect({ wsEndpoint: args.ws });
      } else if (args.browserUrl) {
        lines.push(out.dim(`连接到 ${args.browserUrl}...`));
        mp = await automator.connect({ wsEndpoint: args.browserUrl } as any);
      } else if (args.project) {
        // 将相对路径转为绝对路径
        const projectPath = resolve(args.project);
        // 校验小程序项目路径
        const pathError = validateProjectPath(projectPath);
        if (pathError) {
          throw new Error(pathError);
        }
        const launchOpts: any = { projectPath };
        if (args.cliPath) launchOpts.cliPath = args.cliPath;
        if (args.autoPort) launchOpts.port = args.autoPort;
        lines.push(out.dim(`启动项目: ${projectPath}...`));
        mp = await automator.launch(launchOpts);
      } else {
        throw new Error('请指定 --project 或 --ws 或 --browserUrl');
      }

      ctx.miniProgram = mp;
      ctx.currentPage = await mp.currentPage();
      ctx.lastConnectionParams = args;

      // 记住项目路径，供自动重连使用
      if (args.project) {
        ctx.defaultProject = args.project;
      }

      const elapsed = Date.now() - startTime;
      lines.push(out.success(`连接成功 (${elapsed}ms)`));
      lines.push(`  页面: ${ctx.currentPage?.path || 'unknown'}`);

      // 自动启动监听
      const monitorLogs = await setupAutoMonitoring(ctx);
      for (const log of monitorLogs) {
        lines.push(out.dim(`  ${log}`));
      }

      // 获取小程序路由信息
      const initLogs = await initAppInfo(ctx);
      for (const log of initLogs) {
        lines.push(`  ${log}`);
      }
    } catch (e: any) {
      lines.push(out.error(`连接失败: ${e.message}`));
      if (args.verbose && e.stack) {
        lines.push(out.dim(e.stack));
      }
    }

    return lines.join('\n');
  },
});

export const reconnectDevtools: CommandDef = defineCommand({
  name: 'reconnect',
  description: '重新连接到微信开发者工具（复用上次连接参数）',
  category: '连接管理',
  args: [
    { name: 'project', type: 'string', description: '覆盖项目路径', alias: 'p' },
    { name: 'ws', type: 'string', description: '覆盖 WebSocket 端点' },
  ],
  handler: async (args, ctx) => {
    if (!ctx.lastConnectionParams && !args.project && !args.ws) {
      return out.error('没有上次的连接参数，请使用 open');
    }

    // 先断开
    if (ctx.miniProgram) {
      try { await ctx.miniProgram.disconnect(); } catch {}
      ctx.reset();
    }

    // 合并参数
    const mergedArgs = { ...ctx.lastConnectionParams, ...args };
    return connectDevtools.handler(mergedArgs, ctx);
  },
});

export const disconnectDevtools: CommandDef = defineCommand({
  name: 'close',
  description: '断开与微信开发者工具的连接',
  category: '连接管理',
  args: [],
  handler: async (_args, ctx) => {
    if (!ctx.miniProgram) {
      return out.warn('当前未连接');
    }

    try {
      await ctx.miniProgram.disconnect();
    } catch (e: any) {
      // 忽略断开时的错误
    }

    ctx.reset();
    return out.success('已断开连接');
  },
});

export const getConnectionStatus: CommandDef = defineCommand({
  name: 'status',
  description: '获取当前连接状态',
  category: '连接管理',
  args: [
    { name: 'refresh', type: 'boolean', default: true, description: '刷新健康检查状态' },
  ],
  handler: async (args, ctx) => {
    const lines: string[] = [];
    const connected = !!ctx.miniProgram;

    lines.push(`连接状态: ${connected ? out.success('已连接') : out.error('未连接')}`);

    if (connected) {
      try {
        if (args.refresh) {
          ctx.currentPage = await ctx.miniProgram!.currentPage();
        }
        lines.push(`  当前页面: ${ctx.currentPage?.path || 'unknown'}`);
        lines.push(`  元素映射: ${ctx.elementMap.size} 个`);
        lines.push(`  Console 监听: ${ctx.consoleListening ? '开启' : '关闭'} (${ctx.consoleMessages.length} 条消息)`);
        lines.push(`  Network 监听: ${ctx.networkListening ? '开启' : '关闭'} (${ctx.networkRequests.length} 条请求)`);
      } catch (e: any) {
        lines.push(out.warn(`连接可能已断开: ${e.message}`));
      }
    }

    return lines.join('\n');
  },
});

export const connectionCommands: CommandDef[] = [
  connectDevtools,
  reconnectDevtools,
  disconnectDevtools,
  getConnectionStatus,
];

/**
 * 连接管理命令组
 * open, launch, close, status
 */

import { defineCommand, type CommandDef } from '../registry.js';
import { SharedContext, NETWORK_BUFFER_SIZE } from '../context.js';
import * as out from '../utils/output.js';
import { validateProjectPath } from '../utils/preflight.js';
import { ensureCliPath, execCli } from '../utils/ide-cli.js';

// @ts-ignore - miniprogram-automator 没有类型定义
import automator from 'miniprogram-automator';

async function setupAutoMonitoring(ctx: SharedContext): Promise<string[]> {
  const logs: string[] = [];

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

  try {
    if (ctx.miniProgram && !ctx.networkListening) {
      const bufferSize = NETWORK_BUFFER_SIZE;
      await ctx.miniProgram.evaluate(`function() {
        wx.__networkLogs = wx.__networkLogs || [];
        wx.__networkBufferSize = ${bufferSize};
      }`);

      await ctx.miniProgram.mockWxMethod('request', function(options: any) {
        const start = Date.now();
        const entry: any = {
          type: 'request',
          method: options.method || 'GET',
          url: options.url,
          requestData: options.data,
          requestHeader: options.header,
          timestamp: start,
          success: false,
          statusCode: 0,
          responseData: null,
          responseHeader: null,
          errMsg: '',
          duration: 0,
        };

        // @ts-ignore
        const logs = wx.__networkLogs;
        logs.push(entry);
        // @ts-ignore
        const maxSize = wx.__networkBufferSize || 200;
        if (logs.length > maxSize) {
          logs.splice(0, logs.length - maxSize);
        }

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

        // @ts-ignore
        return this.origin(options);
      });

      ctx.networkListening = true;
      logs.push('Network 监听已自动启动');
    }
  } catch (e: any) {
    logs.push(`Network 监听启动失败: ${e.message}`);
  }

  return logs;
}

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

    const normalize = (p: string) => p.replace(/^\//, '').replace(/\.html$/, '');
    ctx.appTabBar = config.tabBar || null;
    if (ctx.appTabBar?.list) {
      ctx.appTabBar.list = ctx.appTabBar.list.map((t: any) => ({
        ...t,
        pagePath: normalize(t.pagePath || ''),
      }));
    }

    const tabPaths = new Set((ctx.appTabBar?.list || []).map((t: any) => t.pagePath));
    ctx.appPages = (config.pages || [])
      .map((p: string) => normalize(p))
      .filter((p: string) => !tabPaths.has(p));

    lines.push(`[Pages] ${ctx.appPages.join(', ')}`);
    if (ctx.appTabBar?.list?.length) {
      const tabs = ctx.appTabBar.list.map((t: any) => t.pagePath).join(', ');
      lines.push(`[TabBar] ${tabs}`);
    }
    lines.push(`[Current] ${ctx.currentPage?.path || 'unknown'}`);
  } catch (e: any) {
    lines.push(`[Init] 获取路由信息失败: ${e.message}`);
  }
  return lines;
}

async function connectByWsEndpoint(wsEndpoint: string, timeoutMs: number): Promise<any> {
  const start = Date.now();
  let lastError: any = null;

  while (Date.now() - start < timeoutMs) {
    try {
      return await automator.connect({ wsEndpoint });
    } catch (e: any) {
      lastError = e;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error(`连接超时: ${wsEndpoint}`);
}

function getTimeout(args: Record<string, any>): number {
  return args.timeout || 45000;
}

function getIdeHttpPort(args: Record<string, any>, ctx: SharedContext): number | null {
  const port = args.port ?? ctx.ideHttpPort;
  return port === undefined ? null : port;
}

function getAutomatorPort(args: Record<string, any>, ctx: SharedContext): number {
  return args.autoPort || ctx.automatorPort || 9420;
}

async function openProject(args: Record<string, any>, ctx: SharedContext): Promise<string[]> {
  if (ctx.projectPath) {
    throw new Error('当前 session 已绑定项目。请先执行 close，或使用新的 --session');
  }

  const projectPath = validateProjectPath(args.project);
  const cliPath = args.cliPath || ctx.cliPath || ensureCliPath(ctx);
  const timeout = getTimeout(args);
  const ideHttpPort = getIdeHttpPort(args, ctx);
  const cliArgs = ['open', '--project', projectPath];
  if (ideHttpPort) {
    cliArgs.push('--port', String(ideHttpPort));
  }

  execCli(cliPath, cliArgs, { timeout });

  ctx.cliPath = cliPath;
  ctx.projectPath = projectPath;
  ctx.ideHttpPort = ideHttpPort;
  ctx.defaultProject = projectPath;
  ctx.lastConnectionParams = { project: projectPath, port: ideHttpPort };

  const lines: string[] = [
    out.success('项目已打开'),
    `  项目: ${projectPath}`,
  ];
  if (ideHttpPort) {
    lines.push(`  IDE HTTP 端口: ${ideHttpPort}`);
  }
  return lines;
}

async function launchAutomation(args: Record<string, any>, ctx: SharedContext): Promise<string[]> {
  const lines: string[] = [];

  if (!ctx.projectPath) {
    if (!args.project) {
      throw new Error('当前 session 尚未打开项目。请先执行 open，或在 launch 中传入 --project');
    }
    lines.push(...await openProject(args, ctx));
  }

  if (!ctx.projectPath) {
    throw new Error('当前 session 未绑定项目');
  }

  if (ctx.miniProgram) {
    return [...lines, out.warn('当前 session 已连接 automator')];
  }

  const timeout = getTimeout(args);
  const cliPath = args.cliPath || ctx.cliPath || ensureCliPath(ctx);
  const automatorPort = getAutomatorPort(args, ctx);
  const wsEndpoint = `ws://127.0.0.1:${automatorPort}`;
  const cliArgs = ['auto', '--project', ctx.projectPath, '--auto-port', String(automatorPort)];

  if (args.trustProject) cliArgs.push('--trust-project');
  if (args.ticket) cliArgs.push('--ticket', String(args.ticket));
  if (args.testTicket) cliArgs.push('--test-ticket', String(args.testTicket));

  execCli(cliPath, cliArgs, { timeout });

  const mp = await connectByWsEndpoint(wsEndpoint, timeout);
  ctx.miniProgram = mp;
  ctx.currentPage = await mp.currentPage();
  ctx.cliPath = cliPath;
  ctx.automatorPort = automatorPort;
  ctx.defaultProject = ctx.projectPath;
  ctx.lastConnectionParams = {
    project: ctx.projectPath,
    port: ctx.ideHttpPort,
    autoPort: automatorPort,
  };

  lines.push(out.success('automator 已启动并连接成功'));
  lines.push(`  页面: ${ctx.currentPage?.path || 'unknown'}`);
  lines.push(`  automator 端口: ${automatorPort}`);

  const monitorLogs = await setupAutoMonitoring(ctx);
  for (const log of monitorLogs) {
    lines.push(out.dim(`  ${log}`));
  }

  const initLogs = await initAppInfo(ctx);
  for (const log of initLogs) {
    lines.push(`  ${log}`);
  }

  return lines;
}

async function closeSession(ctx: SharedContext): Promise<string[]> {
  if (!ctx.projectPath && !ctx.miniProgram) {
    return [out.warn('当前 session 不存在可关闭的项目')];
  }

  const lines: string[] = [];
  const projectPath = ctx.projectPath;
  const cliPath = ctx.cliPath;
  const ideHttpPort = ctx.ideHttpPort;

  if (ctx.miniProgram) {
    try {
      await ctx.miniProgram.disconnect();
      lines.push(out.dim('  automator 连接已断开'));
    } catch (e: any) {
      lines.push(out.warn(`断开 automator 连接失败，已继续清理: ${e.message}`));
    }
  }

  if (projectPath) {
    try {
      const resolvedCli = cliPath || ensureCliPath(ctx);
      const cliArgs = ['close', '--project', projectPath];
      if (ideHttpPort) {
        cliArgs.push('--port', String(ideHttpPort));
      }
      execCli(resolvedCli, cliArgs, { timeout: 30000 });
      lines.push(out.dim(`  项目窗口已关闭: ${projectPath}`));
    } catch (e: any) {
      lines.push(out.warn(`关闭项目窗口失败，已继续清理 session: ${e.message}`));
    }
  }

  ctx.reset();
  lines.unshift(out.success('session 已关闭并销毁'));
  return lines;
}

const openDevtools: CommandDef = defineCommand({
  name: 'open',
  description: '打开 IDE 项目并创建 session',
  longDescription: '只负责 IDE / 项目窗口生命周期，不会自动启动 automator。需要自动化操作时，再执行 launch。',
  category: '连接管理',
  args: [
    { name: 'project', type: 'string', required: true, description: '小程序项目绝对路径', alias: 'p' },
    { name: 'port', type: 'number', description: 'IDE HTTP 服务端口' },
    { name: 'cliPath', type: 'string', description: '微信开发者工具 CLI 路径' },
    { name: 'timeout', type: 'number', default: 45000, description: '命令超时(ms)' },
  ],
  examples: [
    { cmd: 'open ./my-miniprogram', desc: '打开项目并创建默认 session' },
    { cmd: 'open ./my-miniprogram --port 41917 --session agent-a', desc: '指定 IDE HTTP 端口和 session ID' },
  ],
  handler: async (args, ctx) => (await openProject(args, ctx)).join('\n'),
});

const launchDevtools: CommandDef = defineCommand({
  name: 'launch',
  description: '启动 automator 并连接当前 session',
  longDescription: '负责 automator 生命周期。默认复用当前 session 已打开的项目；如果当前 session 尚未 open，可以在 launch 中直接传入 --project。',
  category: '连接管理',
  args: [
    { name: 'project', type: 'string', description: '小程序项目绝对路径（当前 session 未 open 时必填）', alias: 'p' },
    { name: 'port', type: 'number', description: 'IDE HTTP 服务端口（仅在 launch 自动 open 时使用）' },
    { name: 'autoPort', type: 'number', description: 'automator WebSocket 端口' },
    { name: 'cliPath', type: 'string', description: '微信开发者工具 CLI 路径' },
    { name: 'trustProject', type: 'boolean', default: false, description: '传递给 CLI auto 的 --trust-project' },
    { name: 'ticket', type: 'string', description: '传递给 CLI auto 的 --ticket' },
    { name: 'testTicket', type: 'string', description: '传递给 CLI auto 的 --test-ticket' },
    { name: 'timeout', type: 'number', default: 45000, description: '命令超时(ms)' },
  ],
  examples: [
    { cmd: 'launch --auto-port 9420', desc: '为当前 session 启动 automator 并连接到 9420' },
    { cmd: 'launch --project ./my-miniprogram --port 41917 --auto-port 9420', desc: '未 open 时一步完成打开项目并启动 automator' },
  ],
  handler: async (args, ctx) => (await launchAutomation(args, ctx)).join('\n'),
});

const closeDevtools: CommandDef = defineCommand({
  name: 'close',
  description: '关闭项目窗口并销毁当前 session',
  longDescription: '关闭 IDE 项目窗口，断开 automator，并删除当前 session。使用 --all 时会依次清理所有 session。',
  category: '连接管理',
  args: [
    { name: 'all', type: 'boolean', default: false, description: '关闭并清理所有 session' },
  ],
  examples: [
    { cmd: 'close', desc: '关闭当前 session 绑定的项目并销毁 session' },
    { cmd: 'close --session agent-a', desc: '关闭指定 session' },
    { cmd: 'close --all', desc: '关闭并清理所有 session' },
  ],
  handler: async (_args, ctx) => (await closeSession(ctx)).join('\n'),
});

const getConnectionStatus: CommandDef = defineCommand({
  name: 'status',
  description: '获取当前 session 状态',
  longDescription: '显示当前 session 的状态、项目路径、IDE HTTP 端口和 automator 端口。状态只会是 opened、connected、error 或 idle。',
  category: '连接管理',
  args: [
    { name: 'refresh', type: 'boolean', default: true, description: 'connected 时刷新当前页面信息' },
  ],
  examples: [
    { cmd: 'status', desc: '查看当前默认 session 的状态' },
    { cmd: 'status --session agent-a', desc: '查看指定 session 的状态' },
  ],
  handler: async (args, ctx) => {
    const lines: string[] = [];
    const rawState = (ctx as any).status || (ctx.miniProgram ? 'connected' : (ctx.projectPath ? 'opened' : 'idle'));

    if (rawState === 'connected' && ctx.miniProgram && args.refresh) {
      try {
        ctx.currentPage = await ctx.miniProgram.currentPage();
      } catch (e: any) {
        lines.push(out.warn(`刷新页面信息失败: ${e.message}`));
      }
    }

    lines.push(`状态: ${
      rawState === 'connected' ? out.success('connected') :
      rawState === 'error' ? out.error('error') :
      rawState === 'opened' ? out.warn('opened') :
      out.dim('idle')
    }`);

    if (ctx.projectPath) lines.push(`  项目: ${ctx.projectPath}`);
    if (ctx.ideHttpPort) lines.push(`  IDE HTTP 端口: ${ctx.ideHttpPort}`);
    if (ctx.automatorPort) lines.push(`  automator 端口: ${ctx.automatorPort}`);
    if (ctx.currentPage?.path) lines.push(`  当前页面: ${ctx.currentPage.path}`);
    if (rawState === 'connected') {
      lines.push(`  Console 监听: ${ctx.consoleListening ? '开启' : '关闭'} (${ctx.consoleMessages.length} 条消息)`);
      lines.push(`  Network 监听: ${ctx.networkListening ? '开启' : '关闭'} (${ctx.networkRequests.length} 条请求)`);
    }
    if (rawState === 'error') {
      lines.push(out.warn('  当前 session 处于 error 状态，请执行 close 后重新 open/launch'));
    }

    return lines.join('\n');
  },
});

export const connectionCommands: CommandDef[] = [
  openDevtools,
  launchDevtools,
  closeDevtools,
  getConnectionStatus,
];

#!/usr/bin/env node

/**
 * mp-cli Daemon 服务
 * 后台进程，通过 Unix Socket 接收命令，管理多个 session（小程序连接）
 */

import * as net from 'net';
import * as fs from 'fs';
import { registry } from './registry.js';
import { coerceArgs } from './parser.js';
import { allCommands } from './commands/index.js';
import { loadConfig, type CliConfig } from './commands/config.js';
import { SessionManager } from './session-manager.js';
import { createSessionCommands } from './commands/session.js';
import { Session } from './context.js';
import { logger } from './utils/logger.js';

// ==================== 常量 ====================

import { SOCKET_PATH, PID_FILE } from './constants.js';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟空闲自动退出
const COMMAND_TIMEOUT_MS = 120_000;      // 单条命令最长 2 分钟
const SHUTDOWN_TIMEOUT_MS = 10_000;      // 优雅关闭最长 10 秒
const MAX_BUFFER_SIZE = 1024 * 1024;     // 客户端 buffer 最大 1MB

/** 不需要 resolve session 的命令（session 管理命令通过闭包捕获 sessionMgr） */
const SESSION_META_COMMANDS = new Set(['sessions', 'switch-session']);

// ==================== 初始化 ====================

// daemon 始终开启日志（通过 WX_DEBUG 环境变量控制，或默认 info 级别）
const debugMode = process.env.WX_DEBUG === '1';
logger.init(true, 'daemon');
if (!debugMode) {
  // 非调试模式下只记录 info 及以上，不输出 debug 级别
  logger.setLevel('info');
}

// 注册所有命令（含 session 占位命令）
registry.registerAll(allCommands);

// 创建 SessionManager
const sessionMgr = new SessionManager();

// 全局配置（不属于单个 session，从持久化文件加载）
const globalConfig: CliConfig = loadConfig();

// 用工厂创建的真实 session 命令覆盖占位
for (const cmd of createSessionCommands(sessionMgr)) {
  registry.register(cmd);
}

// 空闲计时器
let idleTimer: NodeJS.Timeout | null = null;

// 请求串行化锁（防止并发修改 ctx）
let commandLock: Promise<void> = Promise.resolve();

// 关闭保护标志
let isShuttingDown = false;

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    logger.info('空闲超时，自动关闭');
    gracefulShutdown();
  }, IDLE_TIMEOUT_MS);
}

/**
 * 将全局配置复制到 session 上（connect 时调用）
 */
function applyGlobalConfig(session: Session): void {
  if (globalConfig.cliPath) session.cliPath = globalConfig.cliPath;
  if (globalConfig.defaultProject) session.defaultProject = globalConfig.defaultProject;
}

// ==================== 请求处理 ====================

interface DaemonRequest {
  command: string;
  args: Record<string, any>;
  session?: string;
}

interface DaemonResponse {
  ok: boolean;
  output?: string;
  error?: string;
}

/**
 * 为请求解析 session 上下文。
 * 返回 Session 实例，或 null（表示该命令不需要 session）。
 */
function resolveSessionForRequest(command: string, reqSession?: string): Session | null {
  // session 管理命令通过闭包访问 sessionMgr，不需要 ctx
  if (SESSION_META_COMMANDS.has(command)) {
    return null;
  }

  if (command === 'open') {
    let session: Session;
    if (reqSession && sessionMgr.get(reqSession)) {
      // 显式指定且已存在 → 复用（reconnect 场景）
      session = sessionMgr.get(reqSession)!;
    } else {
      // 创建新 session
      session = sessionMgr.create(reqSession || undefined);
    }
    // 首个 session 或无活跃 session 时自动设为活跃
    if (!sessionMgr.activeId) {
      sessionMgr.setActive(session.id);
    }
    applyGlobalConfig(session);
    return session;
  }

  // 其他命令：resolve
  return sessionMgr.resolve(reqSession);
}

async function handleRequest(req: DaemonRequest): Promise<DaemonResponse> {
  const { command, args } = req;

  // 内置特殊命令（不加锁，不加超时）
  switch (command) {
    case '__ping':
      return { ok: true, output: 'pong' };

    case '__shutdown':
      // 异步关闭，先返回响应
      setTimeout(() => gracefulShutdown(), 100);
      return { ok: true, output: 'daemon 正在关闭' };

    case '__status': {
      const sessions = sessionMgr.getAll().map(s => s.toSummary());
      return {
        ok: true,
        output: JSON.stringify({
          pid: process.pid,
          uptime: Math.floor(process.uptime()),
          activeSession: sessionMgr.activeId,
          sessions,
        }),
      };
    }
  }

  // 查找注册命令
  const cmd = registry.get(command);
  const finalArgs = { ...args };

  if (!cmd) {
    logger.warn(`未知命令: ${command}`);
    return { ok: false, error: `未知命令: ${command}` };
  }

  // 串行执行（防止并发修改 ctx）+ 超时保护
  return new Promise<DaemonResponse>((resolve) => {
    commandLock = commandLock.then(async () => {
      const startTime = Date.now();
      const timer = setTimeout(() => {
        logger.error(`命令超时: ${command}`, `(${COMMAND_TIMEOUT_MS}ms)`);
        resolve({ ok: false, error: `命令超时 (${COMMAND_TIMEOUT_MS}ms): ${command}` });
      }, COMMAND_TIMEOUT_MS);

      // 在 try 外部声明 ctx，catch 中也能访问
      let ctx: Session | null = null;

      try {
        ctx = resolveSessionForRequest(command, req.session);

        if (ctx) ctx.touch();

        const sessionLabel = ctx ? ` [session=${ctx.id}]` : '';
        logger.debug(`exec: ${command}${sessionLabel}`, finalArgs);

        const coerced = coerceArgs(finalArgs, cmd.args);
        const result = await cmd.handler(coerced, ctx as any);

        clearTimeout(timer);
        logger.debug(`done: ${command}${sessionLabel}`, `(${Date.now() - startTime}ms)`);

        // connect 成功后标记 connected
        if (command === 'open' && ctx?.miniProgram) {
          ctx.status = 'connected';
        }

        // disconnect 后标记 disconnected（session 保留在 map 中）
        if (command === 'close' && ctx) {
          ctx.status = 'disconnected';
        }

        resolve({ ok: true, output: result || '' });
      } catch (e: any) {
        clearTimeout(timer);
        logger.error(`fail: ${command}`, `(${Date.now() - startTime}ms)`, e.message);

        // 检测连接断开错误，标记 dead
        if (ctx && ctx.status === 'connected' && isConnectionError(e)) {
          ctx.markDead();
          logger.warn(`Session ${ctx.id} 已标记为 dead`);
        }

        resolve({ ok: false, error: e.message });
      }
    });
  });
}

/**
 * 判断是否为连接断开类错误
 */
function isConnectionError(e: any): boolean {
  const msg = (e.message || '').toLowerCase();
  return msg.includes('disconnected') ||
    msg.includes('not connected') ||
    msg.includes('connection') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('websocket');
}

// ==================== Socket 服务 ====================

function startServer(): void {
  // 清理残留的 socket 文件
  if (fs.existsSync(SOCKET_PATH)) {
    try {
      fs.unlinkSync(SOCKET_PATH);
      logger.debug('清理残留 socket 文件');
    } catch {
      logger.error(`无法清理 socket: ${SOCKET_PATH}`);
      process.exit(1);
    }
  }

  const server = net.createServer((conn) => {
    resetIdleTimer();
    logger.debug('新连接');

    let buffer = '';

    conn.on('data', (data) => {
      buffer += data.toString();

      // 防止客户端发送无限数据
      if (buffer.length > MAX_BUFFER_SIZE) {
        logger.warn('请求数据过大，断开连接');
        const resp: DaemonResponse = { ok: false, error: '请求数据过大' };
        conn.write(JSON.stringify(resp) + '\n');
        conn.end();
        buffer = '';
        return;
      }

      // 按 \n 分割处理
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);

        if (!line.trim()) continue;

        let req: DaemonRequest;
        try {
          req = JSON.parse(line);
        } catch {
          logger.warn('无效的 JSON 请求');
          const resp: DaemonResponse = { ok: false, error: '无效的 JSON 请求' };
          conn.write(JSON.stringify(resp) + '\n');
          return;
        }

        const argsStr = Object.keys(req.args || {}).length > 0 ? JSON.stringify(req.args) : '';
        const sessionStr = req.session ? ` [session=${req.session}]` : '';
        logger.info(`← ${req.command}${sessionStr}`, argsStr);

        handleRequest(req).then((resp) => {
          logger.info(`→ ${resp.ok ? 'ok' : 'err'}`, resp.ok ? '' : (resp.error || ''));
          try {
            conn.write(JSON.stringify(resp) + '\n');
          } catch {
            // 连接已关闭，忽略
          }
        });
      }
    });

    conn.on('error', () => {
      // 客户端断开等，忽略
    });
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Socket 已被占用: ${SOCKET_PATH}`);
      process.exit(1);
    }
    logger.error(`服务器错误: ${err.message}`);
    process.exit(1);
  });

  server.listen(SOCKET_PATH, () => {
    // 写 PID 文件
    fs.writeFileSync(PID_FILE, String(process.pid));

    logger.info(`daemon 已启动 (PID: ${process.pid})`);
    logger.info(`socket: ${SOCKET_PATH}`);

    // 启动空闲计时器
    resetIdleTimer();
  });

  // 保存引用用于关闭
  (globalThis as any).__wxDaemonServer = server;
}

// ==================== 优雅关闭 ====================

async function gracefulShutdown(): Promise<void> {
  // 防止重入
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('正在关闭...');

  // 强制退出保底 — 无论如何 SHUTDOWN_TIMEOUT_MS 后一定退出
  const forceTimer = setTimeout(() => {
    logger.error('强制退出（关闭超时）');
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
    try { fs.unlinkSync(PID_FILE); } catch {}
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref(); // 不阻止进程退出

  // 清除空闲计时器
  if (idleTimer) clearTimeout(idleTimer);

  // 断开所有 session 连接
  await sessionMgr.disconnectAll();
  logger.info('所有 session 连接已断开');

  // 关闭 socket 服务
  const server = (globalThis as any).__wxDaemonServer;
  if (server) {
    server.close();
  }

  // 清理文件
  try { fs.unlinkSync(SOCKET_PATH); } catch {}
  try { fs.unlinkSync(PID_FILE); } catch {}

  logger.info('daemon 已关闭');
  logger.close();
  clearTimeout(forceTimer);
  process.exit(0);
}

// 信号处理
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (err) => {
  logger.error(`未捕获异常: ${err.message}`);
  // 不调用 gracefulShutdown（可能会再抛异常导致无限递归）
  // 直接强制清理退出
  try { fs.unlinkSync(SOCKET_PATH); } catch {}
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(1);
});
process.on('unhandledRejection', (reason: any) => {
  logger.error(`未处理的 Promise 拒绝: ${reason?.message || reason}`);
  // 不退出，只记录日志（避免 handler 中的 Promise 错误杀掉 daemon）
});

// ==================== 启动 ====================

startServer();

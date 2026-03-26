#!/usr/bin/env node

/**
 * wx-devtools-cli Daemon 服务
 * 后台进程，通过 Unix Socket 接收命令，持有 miniProgram 连接和状态
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { SharedContext } from './context.js';
import { registry } from './registry.js';
import { coerceArgs } from './parser.js';
import { allCommands } from './commands/index.js';
import { loadPersistedConfig } from './commands/config.js';
import * as out from './utils/output.js';

// ==================== 常量 ====================

import { SOCKET_PATH, PID_FILE } from './constants.js';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟空闲自动退出
const COMMAND_TIMEOUT_MS = 120_000;      // 单条命令最长 2 分钟
const SHUTDOWN_TIMEOUT_MS = 10_000;      // 优雅关闭最长 10 秒
const MAX_BUFFER_SIZE = 1024 * 1024;     // 客户端 buffer 最大 1MB

// ==================== 初始化 ====================

// 注册所有命令
registry.registerAll(allCommands);

// 全局共享上下文
const ctx = new SharedContext();

// 加载持久化配置
loadPersistedConfig(ctx);

// 空闲计时器
let idleTimer: NodeJS.Timeout | null = null;

// 请求串行化锁（防止并发修改 ctx）
let commandLock: Promise<void> = Promise.resolve();

// 关闭保护标志
let isShuttingDown = false;

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    log('空闲超时，自动关闭');
    gracefulShutdown();
  }, IDLE_TIMEOUT_MS);
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  // daemon 运行在后台，日志写到 stderr（可选重定向）
  process.stderr.write(`[daemon ${ts}] ${msg}\n`);
}

// ==================== 请求处理 ====================

interface DaemonRequest {
  command: string;
  args: Record<string, any>;
}

interface DaemonResponse {
  ok: boolean;
  output?: string;
  error?: string;
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

    case '__status':
      return {
        ok: true,
        output: JSON.stringify({
          pid: process.pid,
          connected: !!ctx.miniProgram,
          currentPage: ctx.currentPage?.path || null,
          elementMapSize: ctx.elementMap.size,
          consoleMessages: ctx.consoleMessages.length,
          networkRequests: ctx.networkRequests.length,
          uptime: Math.floor(process.uptime()),
        }),
      };
  }

  // 查找注册命令
  let cmd = registry.get(command);
  let finalArgs = { ...args };

  if (!cmd) {
    return { ok: false, error: `未知命令: ${command}` };
  }

  // 串行执行（防止并发修改 ctx）+ 超时保护
  return new Promise<DaemonResponse>((resolve) => {
    commandLock = commandLock.then(async () => {
      const timer = setTimeout(() => {
        resolve({ ok: false, error: `命令超时 (${COMMAND_TIMEOUT_MS}ms): ${command}` });
      }, COMMAND_TIMEOUT_MS);

      try {
        const coerced = coerceArgs(finalArgs, cmd!.args);
        const result = await cmd!.handler(coerced, ctx);
        clearTimeout(timer);
        resolve({ ok: true, output: result || '' });
      } catch (e: any) {
        clearTimeout(timer);
        resolve({ ok: false, error: e.message });
      }
    });
  });
}

// ==================== Socket 服务 ====================

function startServer(): void {
  // 清理残留的 socket 文件
  if (fs.existsSync(SOCKET_PATH)) {
    try {
      fs.unlinkSync(SOCKET_PATH);
    } catch {
      console.error(`无法清理 socket: ${SOCKET_PATH}`);
      process.exit(1);
    }
  }

  const server = net.createServer((conn) => {
    resetIdleTimer();

    let buffer = '';

    conn.on('data', (data) => {
      buffer += data.toString();

      // 防止客户端发送无限数据
      if (buffer.length > MAX_BUFFER_SIZE) {
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
          const resp: DaemonResponse = { ok: false, error: '无效的 JSON 请求' };
          conn.write(JSON.stringify(resp) + '\n');
          return;
        }

        log(`← ${req.command} ${Object.keys(req.args || {}).length > 0 ? JSON.stringify(req.args) : ''}`);

        handleRequest(req).then((resp) => {
          log(`→ ${resp.ok ? 'ok' : 'err'} ${resp.ok ? '' : resp.error || ''}`);
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
      console.error(`Socket 已被占用: ${SOCKET_PATH}`);
      console.error('可能已有 daemon 在运行，使用 wx-devtools-cli daemon stop 关闭');
      process.exit(1);
    }
    console.error(`服务器错误: ${err.message}`);
    process.exit(1);
  });

  server.listen(SOCKET_PATH, () => {
    // 写 PID 文件
    fs.writeFileSync(PID_FILE, String(process.pid));

    log(`daemon 已启动 (PID: ${process.pid})`);
    log(`socket: ${SOCKET_PATH}`);

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

  log('正在关闭...');

  // 强制退出保底 — 无论如何 SHUTDOWN_TIMEOUT_MS 后一定退出
  const forceTimer = setTimeout(() => {
    log('强制退出（关闭超时）');
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
    try { fs.unlinkSync(PID_FILE); } catch {}
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref(); // 不阻止进程退出

  // 清除空闲计时器
  if (idleTimer) clearTimeout(idleTimer);

  // 断开 miniProgram 连接（带超时）
  if (ctx.miniProgram) {
    try {
      await Promise.race([
        ctx.miniProgram.disconnect(),
        new Promise(r => setTimeout(r, 5000)),
      ]);
      log('miniProgram 连接已断开');
    } catch {
      // 忽略
    }
    ctx.reset();
  }

  // 关闭 socket 服务
  const server = (globalThis as any).__wxDaemonServer;
  if (server) {
    server.close();
  }

  // 清理文件
  try { fs.unlinkSync(SOCKET_PATH); } catch {}
  try { fs.unlinkSync(PID_FILE); } catch {}

  log('daemon 已关闭');
  clearTimeout(forceTimer);
  process.exit(0);
}

// 信号处理
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (err) => {
  log(`未捕获异常: ${err.message}`);
  // 不调用 gracefulShutdown（可能会再抛异常导致无限递归）
  // 直接强制清理退出
  try { fs.unlinkSync(SOCKET_PATH); } catch {}
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(1);
});
process.on('unhandledRejection', (reason: any) => {
  log(`未处理的 Promise 拒绝: ${reason?.message || reason}`);
  // 不退出，只记录日志（避免 handler 中的 Promise 错误杀掉 daemon）
});

// ==================== 启动 ====================

startServer();

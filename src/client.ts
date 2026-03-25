/**
 * wx-devtools-cli IPC 客户端
 * 与 daemon 进程通信
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { SOCKET_PATH, PID_FILE } from './constants.js';

export interface DaemonResponse {
  ok: boolean;
  output?: string;
  error?: string;
}

const COMMAND_TIMEOUT_MS = 120_000; // 2 分钟（connect 可能很慢）
const STARTUP_TIMEOUT_MS = 15_000;  // daemon 启动超时
const STARTUP_POLL_MS = 200;        // 轮询间隔

/**
 * 检查 daemon 是否在运行
 */
export async function isDaemonRunning(): Promise<boolean> {
  if (!fs.existsSync(PID_FILE)) return false;

  // PID 文件存在，验证进程是否还活着
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    process.kill(pid, 0); // 不发信号，只检查进程是否存在
  } catch {
    // 进程不存在，清理残留文件
    try { fs.unlinkSync(PID_FILE); } catch {}
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
    return false;
  }

  // 进程存在，再通过 socket ping 确认 daemon 正常
  try {
    const resp = await sendCommand('__ping', {}, 3000);
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 向 daemon 发送命令
 */
export function sendCommand(
  command: string,
  args: Record<string, any> = {},
  timeout: number = COMMAND_TIMEOUT_MS,
): Promise<DaemonResponse> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(SOCKET_PATH);
    let buffer = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error(`命令超时 (${timeout}ms): ${command}`));
      }
    }, timeout);

    socket.on('connect', () => {
      const req = JSON.stringify({ command, args }) + '\n';
      socket.write(req);
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      const newlineIdx = buffer.indexOf('\n');
      if (newlineIdx !== -1) {
        const line = buffer.slice(0, newlineIdx);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.end();
          try {
            resolve(JSON.parse(line));
          } catch {
            reject(new Error('无效的 daemon 响应'));
          }
        }
      }
    });

    socket.on('error', (err: any) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
          reject(new Error('daemon 未运行'));
        } else {
          reject(new Error(`IPC 错误: ${err.message}`));
        }
      }
    });

    socket.on('close', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('连接意外关闭'));
      }
    });
  });
}

/**
 * 启动 daemon 进程
 */
export async function startDaemon(): Promise<number> {
  // 已经在运行
  if (await isDaemonRunning()) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    return pid;
  }

  // 找到 daemon.js 路径（相对于当前模块）
  const daemonPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    // 如果是 build/ 目录下运行
    'daemon.js',
  );

  // 如果 build/daemon.js 不存在，尝试同目录
  const actualPath = fs.existsSync(daemonPath) ? daemonPath : path.join(path.dirname(daemonPath), 'daemon.js');

  // detached 模式启动
  const child = spawn('node', [actualPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });

  child.unref();

  // 等待 daemon 就绪（轮询 socket）
  const startTime = Date.now();
  while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
    await sleep(STARTUP_POLL_MS);
    try {
      const resp = await sendCommand('__ping', {}, 2000);
      if (resp.ok) {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        return pid;
      }
    } catch {
      // 还没准备好，继续等
    }
  }

  throw new Error(`daemon 启动超时 (${STARTUP_TIMEOUT_MS}ms)`);
}

/**
 * 停止 daemon 进程
 */
export async function stopDaemon(): Promise<void> {
  try {
    await sendCommand('__shutdown', {}, 5000);
  } catch {
    // 可能已经关闭了，尝试直接 kill
    if (fs.existsSync(PID_FILE)) {
      try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        process.kill(pid, 'SIGTERM');
      } catch {}
    }
  }

  // 等待清理完成
  await sleep(500);

  // 强制清理残留
  try { fs.unlinkSync(SOCKET_PATH); } catch {}
  try { fs.unlinkSync(PID_FILE); } catch {}
}

/**
 * 获取 daemon PID（如果在运行）
 */
export function getDaemonPid(): number | null {
  if (!fs.existsSync(PID_FILE)) return null;
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    process.kill(pid, 0); // 检查进程是否存在
    return pid;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

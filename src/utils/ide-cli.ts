/**
 * IDE CLI 工具 — 检测路径 + 封装调用
 */

import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { SharedContext } from '../context.js';

/** 常见安装路径 */
const KNOWN_CLI_PATHS: string[] = [
  // macOS
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli',
  // Windows
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
];

/**
 * 查找 IDE CLI 路径
 * 优先级: ctx.cliPath → 环境变量 → 自动扫描
 */
export function findCliPath(ctx: SharedContext): string | null {
  // 1. 用户手动设置
  if (ctx.cliPath && existsSync(ctx.cliPath)) {
    return ctx.cliPath;
  }

  // 2. 环境变量
  const envPath = process.env.WECHAT_DEVTOOLS_CLI;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  // 3. 自动扫描
  for (const p of KNOWN_CLI_PATHS) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * 确保能找到 CLI，找不到则抛错
 */
export function ensureCliPath(ctx: SharedContext): string {
  const cliPath = findCliPath(ctx);
  if (!cliPath) {
    throw new Error(
      '未找到微信开发者工具 CLI。\n' +
      '  请通过以下方式之一配置：\n' +
      '  1. config --cliPath /path/to/cli\n' +
      '  2. 设置环境变量 WECHAT_DEVTOOLS_CLI=/path/to/cli\n' +
      '  3. 将微信开发者工具安装到默认路径'
    );
  }
  return cliPath;
}

export interface ExecCliOptions {
  /** 超时时间(ms)，默认 120000 */
  timeout?: number;
  /** stdio 模式，login 等需要 inherit 显示二维码 */
  inherit?: boolean;
}

function quotePowerShellArg(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * 执行 IDE CLI 命令
 * @returns stdout 输出（inherit 模式返回空字符串）
 */
export function execCli(cliPath: string, args: string[], opts?: ExecCliOptions): string {
  const timeout = opts?.timeout ?? 120000;
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'powershell.exe' : cliPath;
  const commandArgs = isWindows
    ? [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `& ${quotePowerShellArg(cliPath)} ${args.map(arg => quotePowerShellArg(arg)).join(' ')}`,
      ]
    : args;

  const result = spawnSync(command, commandArgs, {
    stdio: opts?.inherit ? 'inherit' : 'pipe',
    timeout,
    encoding: 'utf-8',
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const detail = stderr || stdout;
    throw new Error(detail ? `CLI 退出码: ${result.status}\n${detail}` : `CLI 退出码: ${result.status}`);
  }

  if (opts?.inherit) {
    return '';
  }

  return result.stdout?.trim() || '';
}

/**
 * 解析项目路径：优先用户传入，其次 ctx.defaultProject
 */
export function resolveProject(args: Record<string, any>, ctx: SharedContext): string | undefined {
  const project = args.project || ctx.defaultProject;
  return project ? String(project) : undefined;
}

/**
 * 解析 islogin 命令的输出，返回是否已登录
 * 支持 JSON 格式 {"login":true/false} 和文本格式 "login" / "not login"
 */
export function parseLoginStatus(output: string): boolean {
  const trimmed = output.trim();
  try {
    const json = JSON.parse(trimmed);
    return !!json.login;
  } catch {
    const lower = trimmed.toLowerCase();
    return !lower.includes('not') && lower.includes('login');
  }
}

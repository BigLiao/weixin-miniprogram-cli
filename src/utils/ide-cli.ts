/**
 * IDE CLI 工具 — 检测路径 + 封装调用
 */

import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join, resolve } from 'path';
import { SharedContext } from '../context.js';

/** 常见安装路径 */
const MACOS_CLI_PATHS: string[] = [
  // macOS
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli',
];

const WINDOWS_CLI_PATHS: string[] = [
  // Windows
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
];

const WINDOWS_PATH_ARGS = new Set([
  '--project',
  '--qr-output',
  '--result-output',
  '--info-output',
  '--upload-private-key',
]);

export function isWslEnvironment(): boolean {
  if (process.platform !== 'linux') return false;
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;

  try {
    const version = readFileSync('/proc/version', 'utf-8');
    return /microsoft/i.test(version);
  } catch {
    return false;
  }
}

function isWindowsPath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p);
}

function toWslPath(p: string): string | null {
  const normalized = p.replace(/\\/g, '/');
  const match = normalized.match(/^([a-zA-Z]):\/(.*)$/);
  if (!match) return null;

  const [, drive, rest] = match;
  return `/mnt/${drive.toLowerCase()}/${rest}`;
}

function toWindowsPath(p: string): string | null {
  if (isWindowsPath(p)) return p;

  const match = p.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (!match) return null;

  const [, drive, rest] = match;
  return `${drive.toUpperCase()}:\\${rest.replace(/\//g, '\\')}`;
}

function toWindowsInteropPath(p: string): string | null {
  const directWindowsPath = toWindowsPath(p);
  if (directWindowsPath) return directWindowsPath;

  if (!isWslEnvironment()) return null;
  if (!p.startsWith('/')) return null;

  const distro = process.env.WSL_DISTRO_NAME;
  if (!distro) return null;

  return `\\\\wsl.localhost\\${distro}${p.replace(/\//g, '\\')}`;
}

function normalizeArgsForWindows(args: string[]): string[] {
  const normalized: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    normalized.push(arg);

    if (WINDOWS_PATH_ARGS.has(arg) && i + 1 < args.length) {
      const next = args[i + 1];
      const absolutePath = isWindowsPath(next) ? next : resolve(next);
      normalized.push(toWindowsInteropPath(absolutePath) ?? next);
      i++;
    }
  }

  return normalized;
}

function resolveWslCliExecution(cliPath: string): { command: string; args: string[] } | null {
  const windowsCliPath = toWindowsPath(cliPath);
  if (!windowsCliPath) return null;

  const cliDir = dirname(cliPath);
  const windowsNodePath = join(cliDir, 'node.exe');
  const windowsCliJsPath = toWindowsPath(join(cliDir, 'cli.js'));
  if (!windowsCliJsPath || !existsSync(windowsNodePath)) {
    return null;
  }

  return {
    command: windowsNodePath,
    args: [windowsCliJsPath],
  };
}

function resolveExistingCliPath(candidate?: string | null): string | null {
  if (!candidate) return null;
  if (existsSync(candidate)) return candidate;

  if (isWslEnvironment() && isWindowsPath(candidate)) {
    const wslPath = toWslPath(candidate);
    if (wslPath && existsSync(wslPath)) {
      return wslPath;
    }
  }

  return null;
}

function getKnownCliPaths(): string[] {
  if (process.platform === 'darwin') return MACOS_CLI_PATHS;
  if (process.platform === 'win32') return WINDOWS_CLI_PATHS;
  if (isWslEnvironment()) return WINDOWS_CLI_PATHS.map(p => toWslPath(p) ?? p);
  return [];
}

/**
 * 查找 IDE CLI 路径
 * 优先级: ctx.cliPath → 环境变量 → 自动扫描
 */
export function findCliPath(ctx: SharedContext): string | null {
  // 1. 用户手动设置
  const configuredCli = resolveExistingCliPath(ctx.cliPath);
  if (configuredCli) {
    return configuredCli;
  }

  // 2. 环境变量
  const envPath = process.env.WECHAT_DEVTOOLS_CLI;
  const resolvedEnvCli = resolveExistingCliPath(envPath);
  if (resolvedEnvCli) {
    return resolvedEnvCli;
  }

  // 3. 自动扫描
  for (const p of getKnownCliPaths()) {
    const resolved = resolveExistingCliPath(p);
    if (resolved) {
      return resolved;
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

export interface ResolveIdeProjectTargetOptions {
  /** 是否必须解析出项目目标，默认 true */
  required?: boolean;
}

export interface IdeProjectTarget {
  /** 传给官方 CLI 的项目参数 */
  cliArgs: string[];
  /** 用户可读标签，用于日志输出 */
  label: string;
  /** 目标来源 */
  source: 'project' | 'appid';
  /** 规范化后的项目路径 */
  project?: string;
  /** AppID */
  appid?: string;
  /** 第三方平台开发时的 ext-appid */
  extAppid?: string;
}

function runCli(cliPath: string, args: string[], opts?: ExecCliOptions): ReturnType<typeof spawnSync> {
  const timeout = opts?.timeout ?? 120000;
  const encoding = 'utf-8';
  const stdio = opts?.inherit ? 'inherit' : 'pipe';

  if (isWslEnvironment()) {
    const wslCliExecution = resolveWslCliExecution(cliPath);
    if (wslCliExecution) {
      const windowsArgs = normalizeArgsForWindows(args);
      return spawnSync(wslCliExecution.command, [...wslCliExecution.args, ...windowsArgs], {
        stdio,
        timeout,
        encoding,
      });
    }
  }

  if (process.platform === 'win32') {
    return spawnSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `& ${quotePowerShellArg(cliPath)} ${args.map(arg => quotePowerShellArg(arg)).join(' ')}`,
    ], {
      stdio,
      timeout,
      encoding,
      windowsHide: true,
    });
  }

  return spawnSync(cliPath, args, {
    stdio,
    timeout,
    encoding,
    windowsHide: true,
  });
}

function quotePowerShellArg(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * 执行 IDE CLI 命令
 * @returns stdout 输出（inherit 模式返回空字符串）
 */
export function execCli(cliPath: string, args: string[], opts?: ExecCliOptions): string {
  const result = runCli(cliPath, args, opts);

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    const detail = stderr || stdout;
    throw new Error(detail ? `CLI 退出码: ${result.status}\n${detail}` : `CLI 退出码: ${result.status}`);
  }

  if (opts?.inherit) return '';
  return typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

/**
 * 解析 IDE 项目目标：优先 --project / defaultProject，其次 --appid / --ext-appid
 *
 * 与官方 CLI 保持一致：如果提供了 --project，则忽略 --appid / --ext-appid。
 */
export function resolveIdeProjectTarget(
  args: Record<string, any>,
  ctx: SharedContext,
  options: { required: false },
): IdeProjectTarget | null;
export function resolveIdeProjectTarget(
  args: Record<string, any>,
  ctx: SharedContext,
  options?: ResolveIdeProjectTargetOptions,
): IdeProjectTarget;
export function resolveIdeProjectTarget(
  args: Record<string, any>,
  ctx: SharedContext,
  options?: ResolveIdeProjectTargetOptions,
): IdeProjectTarget | null {
  const required = options?.required ?? true;
  const explicitProject = args.project ? String(args.project) : undefined;
  const appid = args.appid ? String(args.appid) : undefined;
  const extAppid = args['ext-appid'] ? String(args['ext-appid']) : undefined;
  const defaultProject = ctx.defaultProject ? String(ctx.defaultProject) : undefined;

  if (explicitProject) {
    return {
      cliArgs: ['--project', explicitProject],
      label: explicitProject,
      source: 'project',
      project: explicitProject,
    };
  }

  if (extAppid && !appid) {
    throw new Error('使用 --ext-appid 时必须同时指定 --appid');
  }

  if (appid) {
    const cliArgs = ['--appid', appid];
    const labelParts = [`AppID: ${appid}`];
    if (extAppid) {
      cliArgs.push('--ext-appid', extAppid);
      labelParts.push(`ExtAppID: ${extAppid}`);
    }

    return {
      cliArgs,
      label: labelParts.join(', '),
      source: 'appid',
      appid,
      extAppid,
    };
  }

  if (defaultProject) {
    return {
      cliArgs: ['--project', defaultProject],
      label: defaultProject,
      source: 'project',
      project: defaultProject,
    };
  }

  if (!required) {
    return null;
  }

  throw new Error('请指定 --project，或使用 --appid/--ext-appid；也可以先通过 config 设置默认项目');
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

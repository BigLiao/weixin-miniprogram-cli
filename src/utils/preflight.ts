/**
 * 前置检查工具 — open / preview / upload 等命令共用
 *
 * 所有"连接前 / 操作前"的校验逻辑集中在此，
 * CLI 入口和 daemon handler 均可调用。
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findCliPath, execCli } from './ide-cli.js';
import * as out from './output.js';
import type { SharedContext } from '../context.js';

// ==================== 项目路径校验 ====================

/**
 * 校验小程序项目路径
 * 1. 路径是否存在
 * 2. 是否包含 project.config.json
 *
 * @returns 规范化后的绝对路径
 * @throws 校验失败时抛出带用户友好信息的 Error
 */
export function validateProjectPath(projectPath: string): string {
  const absPath = resolve(projectPath);
  if (!existsSync(absPath)) {
    throw new Error(`路径不存在: ${absPath}`);
  }
  if (!existsSync(join(absPath, 'project.config.json'))) {
    throw new Error(
      `该目录不是小程序项目根目录（未找到 project.config.json）: ${absPath}`
    );
  }
  return absPath;
}

// ==================== 登录状态检查 ====================

export interface EnsureLoginResult {
  /** 是否已登录（含本次登录成功） */
  loggedIn: boolean;
  /** 过程日志，调用方可选择打印 */
  logs: string[];
}

/**
 * 确保微信开发者工具已登录
 * - 已登录 → 静默通过
 * - 未登录 → 自动唤起扫码登录（inherit 模式显示二维码）
 * - CLI 不可用 → 跳过（不阻断流程）
 */
export function ensureLogin(ctx: SharedContext): EnsureLoginResult {
  const logs: string[] = [];
  const cliPath = findCliPath(ctx);

  if (!cliPath) {
    logs.push(out.warn('未找到微信开发者工具 CLI，跳过登录检查'));
    return { loggedIn: true, logs }; // 不阻断
  }

  try {
    const status = execCli(cliPath, ['islogin']);
    const isLoggedIn = !status.toLowerCase().includes('not');

    if (isLoggedIn) {
      logs.push(out.dim('  已登录微信开发者工具'));
      return { loggedIn: true, logs };
    }

    // 未登录 → 唤起扫码
    logs.push(out.warn('未登录微信开发者工具，正在唤起登录...'));
    logs.push(out.info('请使用微信扫描二维码：'));
    execCli(cliPath, ['login', '--qr-format', 'terminal'], {
      inherit: true,
      timeout: 180000,
    });

    // 登录后再次确认
    const verify = execCli(cliPath, ['islogin']);
    if (verify.toLowerCase().includes('not')) {
      logs.push(out.error('登录失败，请重试'));
      return { loggedIn: false, logs };
    }

    logs.push(out.success('登录成功'));
    return { loggedIn: true, logs };
  } catch (e: any) {
    logs.push(out.warn(`登录状态检查失败: ${e.message}，继续尝试连接...`));
    return { loggedIn: true, logs }; // 容错：不阻断
  }
}

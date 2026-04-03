/**
 * 前置检查工具 — open / preview / upload 等命令共用
 *
 * 所有"连接前 / 操作前"的校验逻辑集中在此，
 * CLI 入口和 daemon handler 均可调用。
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findCliPath, execCli, parseLoginStatus } from './ide-cli.js';
import { readAppId, getKeyPath, KEYS_DIR } from '../commands/config.js';
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
 * 检查微信开发者工具是否已登录
 * - 已登录 → 静默通过
 * - 未登录 → 返回未登录状态，由调用方决定后续处理
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
    const status = execCli(cliPath, ['islogin']).trim();
    const isLoggedIn = parseLoginStatus(status);

    if (isLoggedIn) {
      logs.push(out.dim('  已登录微信开发者工具'));
      return { loggedIn: true, logs };
    }

    logs.push(out.warn('未登录微信开发者工具'));
    return { loggedIn: false, logs };
  } catch (e: any) {
    logs.push(out.warn(`登录状态检查失败: ${e.message}，继续尝试连接...`));
    return { loggedIn: true, logs }; // 容错：不阻断
  }
}

// ==================== CI 密钥检查 ====================

export interface EnsureCiKeyResult {
  /** 密钥文件路径，null 表示未找到 */
  keyPath: string | null;
  /** appid，null 表示读取失败 */
  appid: string | null;
  /** 过程日志 */
  logs: string[];
}

/**
 * 检查 CI 代码上传密钥是否可用
 * @param projectPath 小程序项目路径
 * @param keyPathArg 命令行 --keyPath 参数（优先使用）
 */
export function ensureCiKey(projectPath: string, keyPathArg?: string): EnsureCiKeyResult {
  const logs: string[] = [];

  // 1. 命令行直接指定
  if (keyPathArg) {
    const absPath = resolve(keyPathArg);
    if (existsSync(absPath)) {
      return { keyPath: absPath, appid: readAppId(projectPath), logs };
    }
    logs.push(out.warn(`指定的密钥文件不存在: ${absPath}`));
    return { keyPath: null, appid: null, logs };
  }

  // 2. 读取 appid
  const appid = readAppId(projectPath);
  if (!appid) {
    logs.push(out.warn('无法从 project.config.json 读取 appid，跳过密钥检查'));
    return { keyPath: null, appid: null, logs };
  }

  // 3. 查找已导入的密钥
  const savedKey = getKeyPath(appid);
  if (savedKey) {
    logs.push(out.dim(`  CI 密钥: ${savedKey}`));
    return { keyPath: savedKey, appid, logs };
  }

  // 4. 未找到，输出提示
  logs.push(out.warn(`未找到小程序 ${appid} 的代码上传密钥`));
  logs.push(out.dim('  请在「微信公众平台 → 开发管理 → 开发设置 → 小程序代码上传」生成密钥'));
  logs.push(out.dim(`  下载后执行: wx-mp-cli config --keyPath <密钥文件路径> --project ${projectPath}`));
  logs.push(out.dim(`  密钥将保存到: ${join(KEYS_DIR, appid + '.key')}`));

  return { keyPath: null, appid, logs };
}

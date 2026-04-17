/**
 * IDE 管理命令组 (11个)
 * ide-open, login, islogin, preview, auto-preview,
 * upload, build-npm, auto, ide-close, quit, cache
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import {
  ensureCliPath,
  execCli,
  resolveIdeProjectTarget,
  parseLoginStatus,
} from '../utils/ide-cli.js';
import { ensureCiKey } from '../utils/preflight.js';

const CATEGORY = 'IDE 管理';

const IDE_PROJECT_ARGS = [
  { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
  { name: 'appid', type: 'string', description: '小程序 AppID 或第三方平台 AppID' },
  { name: 'ext-appid', type: 'string', description: '第三方平台开发时被开发 AppID' },
] as const;

function resolveCiKeyArgs(projectPath?: string, keyPathArg?: string, appid?: string) {
  if (projectPath) {
    return ensureCiKey(projectPath, keyPathArg);
  }

  if (!keyPathArg) {
    return { keyPath: null, appid: appid || null, logs: [] as string[] };
  }

  const absPath = resolve(keyPathArg);
  if (existsSync(absPath)) {
    return { keyPath: absPath, appid: appid || null, logs: [] as string[] };
  }

  return {
    keyPath: null,
    appid: appid || null,
    logs: [out.warn(`指定的密钥文件不存在: ${absPath}`)],
  };
}

// ==================== ide open ====================

export const ideOpen: CommandDef = defineCommand({
  name: 'ide-open',
  description: '打开 IDE / 打开项目',
  category: CATEGORY,
  args: [...IDE_PROJECT_ARGS],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const cliArgs = ['open'];
    const target = resolveIdeProjectTarget(args, ctx, { required: false });
    if (target) cliArgs.push(...target.cliArgs);

    try {
      const result = execCli(cli, cliArgs);
      if (result.includes('[error]')) {
        throw new Error(result);
      }
      const lines = [out.success('IDE 已打开')];
      if (target) {
        lines.push(`  目标: ${target.label}`);
        if (target.project) {
          ctx.defaultProject = target.project;
        }
      }
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return out.error(`打开 IDE 失败: ${e.message}`);
    }
  },
});

// ==================== ide login ====================

export const ideLogin: CommandDef = defineCommand({
  name: 'login',
  description: '登录微信开发者工具（终端显示二维码）',
  category: CATEGORY,
  args: [
    { name: 'format', type: 'string', default: 'terminal', description: '二维码格式: terminal|image|base64', alias: 'f' },
    { name: 'qr-size', type: 'string', default: 'default', description: '二维码大小: small|default' },
    { name: 'output', type: 'string', description: '二维码保存路径（format=image 时使用）', alias: 'o' },
    { name: 'result-output', type: 'string', description: '登录结果输出路径', alias: 'r' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const cliArgs = ['login', '--qr-format', args.format || 'terminal'];
    if (args['qr-size']) cliArgs.push('--qr-size', args['qr-size']);
    if (args.output) cliArgs.push('--qr-output', args.output);
    if (args['result-output']) cliArgs.push('--result-output', args['result-output']);

    try {
      const timeOutMs = 180000;
      const lines: string[] = [out.info(`请使用微信扫描二维码（等待超时时间：${timeOutMs}ms）：`), '（必须用户手动操作）'];
      execCli(cli, cliArgs, { inherit: true, timeout: timeOutMs });
      lines.push(out.success('登录完成'));
      return lines.join('\n');
    } catch (e: any) {
      return out.error(`登录失败: ${e.message}`);
    }
  },
});

// ==================== ide islogin ====================

export const ideIslogin: CommandDef = defineCommand({
  name: 'islogin',
  description: '检查是否已登录',
  category: CATEGORY,
  args: [],
  handler: async (_args, ctx) => {
    const cli = ensureCliPath(ctx);
    try {
      const result = execCli(cli, ['islogin']).trim();
      const loggedIn = parseLoginStatus(result);
      if (!loggedIn) {
        return out.warn(`未登录 (${result})`);
      }
      return out.success(`已登录 (${result})`);
    } catch (e: any) {
      return out.error(`检查登录状态失败: ${e.message}`);
    }
  },
});

// ==================== ide preview ====================

export const idePreview: CommandDef = defineCommand({
  name: 'preview',
  description: '预览小程序（生成二维码）',
  category: CATEGORY,
  args: [
    ...IDE_PROJECT_ARGS,
    { name: 'format', type: 'string', default: 'terminal', description: '二维码格式: terminal|image|base64', alias: 'f' },
    { name: 'output', type: 'string', description: '二维码保存路径', alias: 'o' },
    { name: 'infoOutput', type: 'string', description: '预览信息输出路径', alias: 'i' },
    { name: 'compileCond', type: 'json', description: '自定义编译条件 (JSON)' },
    { name: 'keyPath', type: 'string', description: 'CI 代码上传密钥路径' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const target = resolveIdeProjectTarget(args, ctx);
    const cliArgs = ['preview', ...target.cliArgs];
    cliArgs.push('--qr-format', args.format || 'terminal');
    if (args.output) cliArgs.push('--qr-output', args.output);
    if (args.infoOutput) cliArgs.push('--info-output', args.infoOutput);
    if (args.compileCond) cliArgs.push('--compile-condition', JSON.stringify(args.compileCond));

    // CI 密钥检查
    const ciKey = resolveCiKeyArgs(target.project, args.keyPath, target.appid);
    const keyLogs = ciKey.logs;
    if (ciKey.keyPath) {
      cliArgs.push('--upload-private-key', ciKey.keyPath);
    }

    try {
      const lines: string[] = [...keyLogs, out.info('正在编译预览...')];
      execCli(cli, cliArgs, { inherit: true, timeout: 180000 });
      lines.push(out.success('预览完成'));
      return lines.join('\n');
    } catch (e: any) {
      return [...keyLogs, out.error(`预览失败: ${e.message}`)].join('\n');
    }
  },
});

// ==================== ide auto-preview ====================

export const ideAutoPreview: CommandDef = defineCommand({
  name: 'auto-preview',
  description: '自动预览（输出预览信息到文件）',
  category: CATEGORY,
  args: [
    ...IDE_PROJECT_ARGS,
    { name: 'infoOutput', type: 'string', description: '预览信息输出路径', alias: 'i' },
    { name: 'keyPath', type: 'string', description: 'CI 代码上传密钥路径' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const target = resolveIdeProjectTarget(args, ctx);
    const cliArgs = ['auto-preview', ...target.cliArgs];
    if (args.infoOutput) cliArgs.push('--info-output', args.infoOutput);

    // CI 密钥检查
    const ciKey = resolveCiKeyArgs(target.project, args.keyPath, target.appid);
    const keyLogs = ciKey.logs;
    if (ciKey.keyPath) {
      cliArgs.push('--upload-private-key', ciKey.keyPath);
    }

    try {
      const result = execCli(cli, cliArgs, { timeout: 180000 });
      const lines = [...keyLogs, out.success('自动预览完成')];
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return [...keyLogs, out.error(`自动预览失败: ${e.message}`)].join('\n');
    }
  },
});

// ==================== ide upload ====================

export const ideUpload: CommandDef = defineCommand({
  name: 'upload',
  description: '上传代码',
  category: CATEGORY,
  args: [
    ...IDE_PROJECT_ARGS,
    { name: 'version', type: 'string', required: true, description: '版本号', alias: 'v' },
    { name: 'desc', type: 'string', default: '', description: '版本描述', alias: 'd' },
    { name: 'infoOutput', type: 'string', description: '上传信息输出路径', alias: 'i' },
    { name: 'keyPath', type: 'string', description: 'CI 代码上传密钥路径' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const target = resolveIdeProjectTarget(args, ctx);
    const cliArgs = ['upload', ...target.cliArgs, '-v', args.version];
    if (args.desc) cliArgs.push('-d', args.desc);
    if (args.infoOutput) cliArgs.push('--info-output', args.infoOutput);

    // CI 密钥检查
    const ciKey = resolveCiKeyArgs(target.project, args.keyPath, target.appid);
    const keyLogs = ciKey.logs;
    if (ciKey.keyPath) {
      cliArgs.push('--upload-private-key', ciKey.keyPath);
    }

    try {
      const lines: string[] = [...keyLogs, out.info(`上传中 (v${args.version})...`)];
      const result = execCli(cli, cliArgs, { timeout: 300000 });
      lines.push(out.success(`上传完成: v${args.version}`));
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return [...keyLogs, out.error(`上传失败: ${e.message}`)].join('\n');
    }
  },
});

// ==================== ide build-npm ====================

export const ideBuildNpm: CommandDef = defineCommand({
  name: 'build-npm',
  description: '构建 NPM',
  category: CATEGORY,
  args: [
    ...IDE_PROJECT_ARGS,
    { name: 'compile-type', type: 'string', description: '编译类型: miniprogram|plugin' },
    { name: 'keyPath', type: 'string', description: 'CI 代码上传密钥路径' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const target = resolveIdeProjectTarget(args, ctx);
    const cliArgs = ['build-npm', ...target.cliArgs];
    if (args['compile-type']) cliArgs.push('--compile-type', args['compile-type']);

    // CI 密钥检查
    const ciKey = resolveCiKeyArgs(target.project, args.keyPath, target.appid);
    const keyLogs = ciKey.logs;
    if (ciKey.keyPath) {
      cliArgs.push('--upload-private-key', ciKey.keyPath);
    }

    try {
      const lines: string[] = [...keyLogs, out.info('构建 NPM...')];
      const result = execCli(cli, cliArgs);
      lines.push(out.success('NPM 构建完成'));
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return [...keyLogs, out.error(`NPM 构建失败: ${e.message}`)].join('\n');
    }
  },
});

// ==================== ide auto ====================

export const ideAuto: CommandDef = defineCommand({
  name: 'auto',
  description: '启用自动化端口',
  category: CATEGORY,
  args: [
    ...IDE_PROJECT_ARGS,
    { name: 'autoPort', type: 'number', default: 9420, description: '自动化端口号（默认 9420）' },
    { name: 'auto-account', type: 'string', description: '指定使用的 openid' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const target = resolveIdeProjectTarget(args, ctx);
    const cliArgs = ['auto', ...target.cliArgs];
    if (args.autoPort) cliArgs.push('--auto-port', String(args.autoPort));
    if (args['auto-account']) cliArgs.push('--auto-account', args['auto-account']);

    try {
      const result = execCli(cli, cliArgs);
      const lines = [out.success('自动化已启用')];
      lines.push(`  目标: ${target.label}`);
      if (args.autoPort) lines.push(`  端口: ${args.autoPort}`);
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return out.error(`启用自动化失败: ${e.message}`);
    }
  },
});

// ==================== ide close ====================

export const ideClose: CommandDef = defineCommand({
  name: 'ide-close',
  description: '关闭项目窗口',
  category: CATEGORY,
  args: [...IDE_PROJECT_ARGS],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const target = resolveIdeProjectTarget(args, ctx);

    try {
      execCli(cli, ['close', ...target.cliArgs]);
      return out.success(`项目已关闭: ${target.label}`);
    } catch (e: any) {
      return out.error(`关闭项目失败: ${e.message}`);
    }
  },
});

// ==================== ide quit ====================

export const ideQuit: CommandDef = defineCommand({
  name: 'quit',
  description: '退出微信开发者工具',
  category: CATEGORY,
  args: [],
  handler: async (_args, ctx) => {
    const cli = ensureCliPath(ctx);
    try {
      execCli(cli, ['quit']);
      return out.success('开发者工具已退出');
    } catch (e: any) {
      return out.error(`退出失败: ${e.message}`);
    }
  },
});

// ==================== ide cache ====================

export const ideCache: CommandDef = defineCommand({
  name: 'cache',
  description: '清除缓存（storage/file/session/auth/network/compile/all）',
  category: CATEGORY,
  args: [
    ...IDE_PROJECT_ARGS,
    { name: 'clean', type: 'string', description: '缓存类型: storage|file|session|auth|network|compile|all', alias: 'c' },
    { name: 'type', type: 'string', description: '已废弃，等同 --clean' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const target = resolveIdeProjectTarget(args, ctx);
    const clean = args.clean || args.type;

    const cliArgs = ['cache', ...target.cliArgs];
    if (clean) cliArgs.push('--clean', clean);

    try {
      const result = execCli(cli, cliArgs);
      const lines = [out.success(`缓存已清除${clean ? ` (${clean})` : ''}`)];
      lines.push(`  目标: ${target.label}`);
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return out.error(`清除缓存失败: ${e.message}`);
    }
  },
});

export const ideCommands: CommandDef[] = [
  ideOpen,
  ideLogin,
  ideIslogin,
  idePreview,
  ideAutoPreview,
  ideUpload,
  ideBuildNpm,
  ideAuto,
  ideClose,
  ideQuit,
  ideCache,
];

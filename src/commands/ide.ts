/**
 * IDE 管理命令组 (11个)
 * ide-open, login, islogin, preview, auto-preview,
 * upload, build-npm, auto, ide-close, quit, cache
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import { ensureCliPath, execCli, resolveProject } from '../utils/ide-cli.js';

const CATEGORY = 'IDE 管理';

// ==================== ide open ====================

export const ideOpen: CommandDef = defineCommand({
  name: 'ide-open',
  description: '打开 IDE / 打开项目',
  category: CATEGORY,
  args: [
    { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const cliArgs = ['open'];
    const project = resolveProject(args, ctx);
    if (project) cliArgs.push('--project', project);

    try {
      const result = execCli(cli, cliArgs);
      const lines = [out.success('IDE 已打开')];
      if (project) {
        lines.push(`  项目: ${project}`);
        ctx.defaultProject = project;
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
    { name: 'output', type: 'string', description: '二维码保存路径（format=image 时使用）', alias: 'o' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const cliArgs = ['login', '--qr-format', args.format || 'terminal'];
    if (args.output) cliArgs.push('--qr-output', args.output);

    try {
      const lines: string[] = [out.info('请使用微信扫描二维码：'), ''];
      execCli(cli, cliArgs, { inherit: true, timeout: 180000 });
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
      const result = execCli(cli, ['islogin']);
      // CLI 输出通常是 "login" 或 "not login"
      if (result.toLowerCase().includes('not')) {
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
    { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
    { name: 'format', type: 'string', default: 'terminal', description: '二维码格式: terminal|image|base64', alias: 'f' },
    { name: 'output', type: 'string', description: '二维码保存路径', alias: 'o' },
    { name: 'infoOutput', type: 'string', description: '预览信息输出路径', alias: 'i' },
    { name: 'compileCond', type: 'json', description: '自定义编译条件 (JSON)' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const project = resolveProject(args, ctx);
    if (!project) return out.error('请指定 --project 或先通过 config 设置默认项目');

    const cliArgs = ['preview', '--project', project];
    cliArgs.push('--qr-format', args.format || 'terminal');
    if (args.output) cliArgs.push('--qr-output', args.output);
    if (args.infoOutput) cliArgs.push('--info-output', args.infoOutput);
    if (args.compileCond) cliArgs.push('--compile-condition', JSON.stringify(args.compileCond));

    try {
      const lines: string[] = [out.info('正在编译预览...')];
      execCli(cli, cliArgs, { inherit: true, timeout: 180000 });
      lines.push(out.success('预览完成'));
      return lines.join('\n');
    } catch (e: any) {
      return out.error(`预览失败: ${e.message}`);
    }
  },
});

// ==================== ide auto-preview ====================

export const ideAutoPreview: CommandDef = defineCommand({
  name: 'auto-preview',
  description: '自动预览（输出预览信息到文件）',
  category: CATEGORY,
  args: [
    { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
    { name: 'infoOutput', type: 'string', description: '预览信息输出路径', alias: 'i' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const project = resolveProject(args, ctx);
    if (!project) return out.error('请指定 --project 或先通过 config 设置默认项目');

    const cliArgs = ['auto-preview', '--project', project];
    if (args.infoOutput) cliArgs.push('--info-output', args.infoOutput);

    try {
      const result = execCli(cli, cliArgs, { timeout: 180000 });
      const lines = [out.success('自动预览完成')];
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return out.error(`自动预览失败: ${e.message}`);
    }
  },
});

// ==================== ide upload ====================

export const ideUpload: CommandDef = defineCommand({
  name: 'upload',
  description: '上传代码',
  category: CATEGORY,
  args: [
    { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
    { name: 'version', type: 'string', required: true, description: '版本号', alias: 'v' },
    { name: 'desc', type: 'string', default: '', description: '版本描述', alias: 'd' },
    { name: 'infoOutput', type: 'string', description: '上传信息输出路径', alias: 'i' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const project = resolveProject(args, ctx);
    if (!project) return out.error('请指定 --project 或先通过 config 设置默认项目');

    const cliArgs = ['upload', '--project', project, '-v', args.version];
    if (args.desc) cliArgs.push('-d', args.desc);
    if (args.infoOutput) cliArgs.push('--info-output', args.infoOutput);

    try {
      const lines: string[] = [out.info(`上传中 (v${args.version})...`)];
      const result = execCli(cli, cliArgs, { timeout: 300000 });
      lines.push(out.success(`上传完成: v${args.version}`));
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return out.error(`上传失败: ${e.message}`);
    }
  },
});

// ==================== ide build-npm ====================

export const ideBuildNpm: CommandDef = defineCommand({
  name: 'build-npm',
  description: '构建 NPM',
  category: CATEGORY,
  args: [
    { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const project = resolveProject(args, ctx);
    if (!project) return out.error('请指定 --project 或先通过 config 设置默认项目');

    try {
      const lines: string[] = [out.info('构建 NPM...')];
      const result = execCli(cli, ['build-npm', '--project', project]);
      lines.push(out.success('NPM 构建完成'));
      if (result) lines.push(out.dim(result));
      return lines.join('\n');
    } catch (e: any) {
      return out.error(`NPM 构建失败: ${e.message}`);
    }
  },
});

// ==================== ide auto ====================

export const ideAuto: CommandDef = defineCommand({
  name: 'auto',
  description: '启用自动化端口',
  category: CATEGORY,
  args: [
    { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
    { name: 'autoPort', type: 'number', default: 9420, description: '自动化端口号（默认 9420）' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const project = resolveProject(args, ctx);
    if (!project) return out.error('请指定 --project 或先通过 config 设置默认项目');

    const cliArgs = ['auto', '--project', project];
    if (args.autoPort) cliArgs.push('--auto-port', String(args.autoPort));

    try {
      const result = execCli(cli, cliArgs);
      const lines = [out.success('自动化已启用')];
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
  args: [
    { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const project = resolveProject(args, ctx);
    if (!project) return out.error('请指定 --project 或先通过 config 设置默认项目');

    try {
      execCli(cli, ['close', '--project', project]);
      return out.success(`项目已关闭: ${project}`);
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
  description: '清除缓存（storage/file/compile/session/auth）',
  category: CATEGORY,
  args: [
    { name: 'project', type: 'string', description: '项目路径', alias: 'p' },
    { name: 'type', type: 'string', description: '缓存类型: storage|file|compile|session|auth（默认全部清除）' },
  ],
  handler: async (args, ctx) => {
    const cli = ensureCliPath(ctx);
    const project = resolveProject(args, ctx);
    if (!project) return out.error('请指定 --project 或先通过 config 设置默认项目');

    const cliArgs = ['cache', '--project', project];
    if (args.type) cliArgs.push('--type', args.type);

    try {
      const result = execCli(cli, cliArgs);
      const lines = [out.success(`缓存已清除${args.type ? ` (${args.type})` : ''}`)];
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

/**
 * config 命令 — 查看/设置 CLI 配置
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import { findCliPath } from '../utils/ide-cli.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

/** 新配置目录 */
export const CONFIG_DIR = join(homedir(), '.weixin-miniprogram-cli');
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
export const KEYS_DIR = join(CONFIG_DIR, 'keys');

/** 旧配置路径（兼容迁移） */
const LEGACY_CONFIG_FILE = join(homedir(), '.wx-mp-cli-config.json');

export interface CliConfig {
  cliPath?: string;
  defaultProject?: string;
}

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(KEYS_DIR, { recursive: true });
}

export function loadConfig(): CliConfig {
  // 优先读新路径
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}

  // 兼容旧路径：读取并自动迁移
  try {
    if (existsSync(LEGACY_CONFIG_FILE)) {
      const config = JSON.parse(readFileSync(LEGACY_CONFIG_FILE, 'utf-8'));
      // 迁移到新路径
      ensureConfigDir();
      writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
      // 删除旧文件
      try { unlinkSync(LEGACY_CONFIG_FILE); } catch {}
      return config;
    }
  } catch {}

  return {};
}

function saveConfig(config: CliConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 从 project.config.json 读取 appid
 */
export function readAppId(projectPath: string): string | null {
  try {
    const configPath = join(resolve(projectPath), 'project.config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config.appid || null;
  } catch {
    return null;
  }
}

/**
 * 获取指定 appid 的密钥路径（如果存在）
 */
export function getKeyPath(appid: string): string | null {
  const keyFile = join(KEYS_DIR, `${appid}.key`);
  return existsSync(keyFile) ? keyFile : null;
}

/**
 * 列出已导入的密钥
 */
function listImportedKeys(): string[] {
  try {
    if (!existsSync(KEYS_DIR)) return [];
    return readdirSync(KEYS_DIR)
      .filter(f => f.endsWith('.key'))
      .map(f => f.replace('.key', ''));
  } catch {
    return [];
  }
}

export const config: CommandDef = defineCommand({
  name: 'config',
  description: '查看或设置 CLI 配置',
  category: '配置',
  args: [
    { name: 'cliPath', type: 'string', description: '设置微信开发者工具 CLI 路径' },
    { name: 'defaultProject', type: 'string', description: '设置默认项目路径' },
    { name: 'keyPath', type: 'string', description: '导入 CI 代码上传密钥（需配合 --project 指定项目）' },
    { name: 'project', type: 'string', description: '项目路径（导入密钥时用于读取 appid）', alias: 'p' },
    { name: 'reset', type: 'boolean', default: false, description: '重置所有配置' },
  ],
  handler: async (args, ctx) => {
    const lines: string[] = [];

    // 重置
    if (args.reset) {
      ctx.cliPath = null;
      ctx.defaultProject = null;
      saveConfig({});
      return out.success(`配置已重置 (${CONFIG_FILE})`);
    }

    // 导入密钥
    if (args.keyPath) {
      const keyFilePath = resolve(args.keyPath);
      if (!existsSync(keyFilePath)) {
        return out.error(`密钥文件不存在: ${keyFilePath}`);
      }

      // 确定 appid
      const projectPath = args.project || ctx.defaultProject;
      if (!projectPath) {
        return out.error('导入密钥需要指定 --project 来确定 appid');
      }
      const appid = readAppId(projectPath);
      if (!appid) {
        return out.error(`无法从 ${projectPath}/project.config.json 中读取 appid`);
      }

      ensureConfigDir();
      const destPath = join(KEYS_DIR, `${appid}.key`);
      copyFileSync(keyFilePath, destPath);
      lines.push(out.success(`密钥已导入: ${appid}`));
      lines.push(out.dim(`  来源: ${keyFilePath}`));
      lines.push(out.dim(`  保存: ${destPath}`));
      return lines.join('\n');
    }

    // 设置配置
    let changed = false;
    if (args.cliPath) {
      ctx.cliPath = args.cliPath;
      changed = true;
    }
    if (args.defaultProject) {
      ctx.defaultProject = args.defaultProject;
      changed = true;
    }

    if (changed) {
      const config: CliConfig = {};
      if (ctx.cliPath) config.cliPath = ctx.cliPath;
      if (ctx.defaultProject) config.defaultProject = ctx.defaultProject;
      saveConfig(config);
      lines.push(out.success(`配置已保存到 ${CONFIG_FILE}`));
    }

    // 显示当前配置
    const detected = findCliPath(ctx);
    lines.push(out.info('当前配置'));
    lines.push(`  cliPath:        ${ctx.cliPath || out.dim('(未设置)')}`);
    lines.push(`  defaultProject: ${ctx.defaultProject || out.dim('(未设置)')}`);
    lines.push(`  检测到的 CLI:   ${detected || out.dim('(未找到)')}`);
    lines.push(`  配置目录:       ${CONFIG_DIR}`);

    // 已导入的密钥
    const keys = listImportedKeys();
    if (keys.length > 0) {
      lines.push(`  已导入密钥:     ${keys.join(', ')}`);
    } else {
      lines.push(`  已导入密钥:     ${out.dim('(无)')}`);
    }

    return lines.join('\n');
  },
});

/**
 * 启动时加载持久化配置
 */
export function loadPersistedConfig(ctx: import('../context.js').SharedContext): void {
  const config = loadConfig();
  if (config.cliPath) ctx.cliPath = config.cliPath;
  if (config.defaultProject) ctx.defaultProject = config.defaultProject;
}

export const configCommands: CommandDef[] = [config];

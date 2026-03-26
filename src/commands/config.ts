/**
 * config 命令 — 查看/设置 CLI 配置
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import { findCliPath } from '../utils/ide-cli.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_FILE = join(homedir(), '.wx-devtools-cli-config.json');

interface CliConfig {
  cliPath?: string;
  defaultProject?: string;
}

function loadConfig(): CliConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveConfig(config: CliConfig): void {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export const config: CommandDef = defineCommand({
  name: 'config',
  description: '查看或设置 CLI 配置（cliPath、defaultProject）',
  category: '配置',
  args: [
    { name: 'cliPath', type: 'string', description: '设置微信开发者工具 CLI 路径' },
    { name: 'defaultProject', type: 'string', description: '设置默认项目路径' },
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

    // 设置
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
    lines.push(`  配置文件:       ${CONFIG_FILE}`);

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

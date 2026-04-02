/**
 * install-skill 命令
 * 将 skills/wx-mp-cli/ 复制到目标 skills 目录
 *
 * 默认安装到项目本地 .claude/skills/wx-mp-cli/
 * --universal  安装到 .agent/skills/wx-mp-cli/（跨 agent 通用）
 * --global     安装到 ~/.claude/skills/wx-mp-cli/（用户全局）
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 递归复制目录 */
function copyDirSync(src: string, dest: string): string[] {
  const copied: string[] = [];
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyDirSync(srcPath, destPath));
    } else {
      fs.copyFileSync(srcPath, destPath);
      copied.push(destPath);
    }
  }
  return copied;
}

export const installSkill: CommandDef = defineCommand({
  name: 'install-skill',
  description: '安装 wx-mp-cli skill（默认项目本地，--universal 通用，--global 全局）',
  category: '配置管理',
  args: [
    { name: 'global', type: 'boolean', default: false, description: '安装到用户全局 ~/.claude/skills/' },
    { name: 'universal', type: 'boolean', default: false, description: '安装到 .agent/skills/（跨 agent 通用）' },
  ],
  handler: async (args, _ctx) => {
    const pkgRoot = path.resolve(__dirname, '..', '..');
    const srcDir = path.join(pkgRoot, 'skills', 'weixin-miniprogram-cli');

    if (!fs.existsSync(srcDir)) {
      return out.error(`skill 源目录不存在: ${srcDir}`);
    }

    let baseDir: string;
    let scope: string;

    if (args.global) {
      baseDir = path.join(homedir(), '.claude', 'skills', 'wx-mp-cli');
      scope = '全局';
    } else if (args.universal) {
      baseDir = path.join(process.cwd(), '.agent', 'skills', 'wx-mp-cli');
      scope = '通用';
    } else {
      baseDir = path.join(process.cwd(), '.claude', 'skills', 'wx-mp-cli');
      scope = '项目';
    }

    const copied = copyDirSync(srcDir, baseDir);
    const relBase = args.global ? baseDir : path.relative(process.cwd(), baseDir);

    const lines = [
      out.success(`已安装 wx-mp-cli skill（${scope}）→ ${relBase}`),
      '',
      ...copied.map(f => out.dim(`  ${args.global ? f : path.relative(process.cwd(), f)}`)),
      '',
      out.dim('Claude Code 会在对话中自动识别并使用此 skill。'),
    ];
    return lines.join('\n');
  },
});

export const skillCommands: CommandDef[] = [installSkill];

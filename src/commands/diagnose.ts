/**
 * doctor 命令 — 一次性输出所有诊断信息
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import * as fs from 'fs';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execCli, findCliPath, isWslEnvironment, parseLoginStatus } from '../utils/ide-cli.js';
import { isDaemonRunning, getDaemonPid, sendCommand } from '../client.js';

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgPath = resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function isDevToolsRunning(): boolean {
  try {
    if (process.platform === 'darwin') {
      const result = execSync('pgrep -f "wechatwebdevtools" 2>/dev/null || true', { encoding: 'utf-8' });
      return !!result.trim();
    }
    if (isWslEnvironment()) {
      const result = spawnSync('tasklist.exe', ['/FI', 'IMAGENAME eq wechatdevtools.exe'], {
        encoding: 'utf-8',
      });
      return typeof result.stdout === 'string' && result.stdout.toLowerCase().includes('wechatdevtools');
    }
    if (process.platform === 'win32') {
      const result = execSync('tasklist /FI "IMAGENAME eq wechatdevtools.exe" 2>nul', { encoding: 'utf-8' });
      return result.includes('wechatdevtools');
    }
    return false;
  } catch {
    return false;
  }
}

function getEnvironmentLabel(): string {
  if (isWslEnvironment()) {
    const distro = process.env.WSL_DISTRO_NAME || 'unknown';
    return `WSL (${distro}) on Windows [node=${process.platform} ${process.arch}]`;
  }
  return `${process.platform} ${process.arch}`;
}

export const doctorCommand: CommandDef = defineCommand({
  name: 'doctor',
  description: '环境与连接诊断，输出所有检查信息',
  category: '诊断工具',
  args: [],
  handler: async (_args, ctx) => {
    const lines: string[] = [out.bold('=== wx-mp-cli doctor ==='), ''];
    let passes = 0;
    let warnings = 0;
    let errors = 0;

    const pass = (msg: string) => { passes++; lines.push(out.success(msg)); };
    const warn = (msg: string) => { warnings++; lines.push(out.warn(msg)); };
    const fail = (msg: string) => { errors++; lines.push(out.error(msg)); };

    // ---- 1. 运行环境 ----
    lines.push(out.highlight('[运行环境]'));
    lines.push(`  wx-mp-cli: v${getVersion()}`);
    lines.push(`  Node.js:   ${process.version}`);
    const major = parseInt(process.version.slice(1));
    if (major >= 16) {
      pass('Node.js 版本满足要求 (>=16)');
    } else {
      fail('Node.js 版本过低，需要 >=16');
    }
    lines.push(`  OS:        ${getEnvironmentLabel()}`);

    try {
      const pkgPath = require.resolve('miniprogram-automator/package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      lines.push(`  automator: v${pkg.version}`);
    } catch {
      lines.push(out.dim('  automator: 已安装（版本未知）'));
    }
    lines.push('');

    // ---- 2. 微信开发者工具 ----
    lines.push(out.highlight('[微信开发者工具]'));

    const cliPath = findCliPath(ctx);
    if (cliPath) {
      pass(`CLI: ${cliPath}`);
    } else {
      fail('未找到微信开发者工具 CLI');
      lines.push(out.dim('  请安装微信开发者工具，或通过 config --cliPath 指定路径'));
    }

    if (isDevToolsRunning()) {
      pass('开发者工具进程运行中');
    }

    if (cliPath) {
      try {
        const status = execCli(cliPath, ['islogin'], { timeout: 30000 }).trim();
        if (parseLoginStatus(status)) {
          pass('已登录');
        } else {
          fail('未登录（请先执行 wx-mp-cli login）');
        }
      } catch {
        warn('登录状态检查失败');
      }
    }

    lines.push('');

    // ---- 3. Daemon 状态 ----
    lines.push(out.highlight('[Daemon]'));
    try {
      const running = await isDaemonRunning();
      if (running) {
        const pid = getDaemonPid();
        pass(`daemon 运行中 (PID: ${pid})`);
        try {
          const resp = await sendCommand('__status');
          if (resp.ok && resp.output) {
            const st = JSON.parse(resp.output);
            lines.push(`  运行时间: ${st.uptime}s`);
            const sessions = st.sessions || [];
            if (sessions.length > 0) {
              lines.push(`  Session: ${sessions.length} 个`);
              for (const s of sessions) {
                const icon = s.status === 'connected' ? '●' : '○';
                lines.push(`    ${icon} ${s.id}  ${s.status}  page=${s.currentPage || '-'}`);
              }
            } else {
              lines.push(out.dim('  无活跃 session'));
            }
          }
        } catch {}
      } else {
        lines.push(out.dim('  未运行'));
      }
    } catch {
      lines.push(out.dim('  状态检查失败'));
    }
    lines.push('');

    // ---- 汇总 ----
    const parts: string[] = [];
    if (passes > 0) parts.push(out.success(`${passes} 通过`));
    if (warnings > 0) parts.push(out.warn(`${warnings} 警告`));
    if (errors > 0) parts.push(out.error(`${errors} 错误`));
    lines.push(parts.join('  '));

    return lines.join('\n');
  },
});

export const diagnoseCommands: CommandDef[] = [doctorCommand];

/**
 * 轻量级日志模块
 *
 * 开启方式（任选其一）：
 *   - 环境变量: WX_DEBUG=1
 *   - CLI 参数: --debug
 *
 * 日志同时写到 stderr（带颜色）和文件（纯文本）。
 * 文件路径: /tmp/wx-devtools-cli.log
 *
 * 级别: debug < info < warn < error
 * 默认级别: 关闭时 warn，开启时 debug
 */

import * as fs from 'fs';
import chalk from 'chalk';
import { LOG_FILE } from '../constants.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const LEVEL_LABELS: Record<string, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
};

const LEVEL_COLORS: Record<string, (s: string) => string> = {
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

class Logger {
  private level: LogLevel = 'silent';
  private scope: string = '';
  private fd: number | null = null;
  private fileEnabled: boolean = false;

  /**
   * 初始化日志系统
   * @param enabled  是否启用 debug 模式
   * @param scope    日志前缀（如 'cli' 或 'daemon'）
   */
  init(enabled: boolean, scope: string = ''): void {
    this.scope = scope;
    this.level = enabled ? 'debug' : 'silent';

    if (enabled) {
      this.openFile();
    }
  }

  /** 设置日志级别 */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /** 当前是否开启了 debug 模式 */
  get enabled(): boolean {
    return this.level !== 'silent';
  }

  debug(msg: string, ...args: any[]): void { this.write('debug', msg, args); }
  info(msg: string, ...args: any[]): void { this.write('info', msg, args); }
  warn(msg: string, ...args: any[]): void { this.write('warn', msg, args); }
  error(msg: string, ...args: any[]): void { this.write('error', msg, args); }

  /** 创建带子作用域的子 logger（共享 fd 和 level） */
  child(subscope: string): ChildLogger {
    return new ChildLogger(this, subscope);
  }

  /** 内部写入 */
  write(level: string, msg: string, args: any[]): void {
    const levelNum = LEVEL_ORDER[level as LogLevel] ?? 0;
    if (levelNum < LEVEL_ORDER[this.level]) return;

    const ts = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    const label = LEVEL_LABELS[level] || level.toUpperCase();
    const scopeStr = this.scope ? `${this.scope} ` : '';
    const extra = args.length > 0 ? ' ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') : '';

    // stderr 带颜色
    const colorFn = LEVEL_COLORS[level] || chalk.white;
    process.stderr.write(colorFn(`[${ts} ${label}] ${scopeStr}${msg}${extra}`) + '\n');

    // 文件纯文本
    if (this.fd !== null) {
      const line = `[${ts} ${label}] ${scopeStr}${msg}${extra}\n`;
      try {
        fs.writeSync(this.fd, line);
      } catch {
        // 写文件失败，静默忽略
      }
    }
  }

  /** 打开日志文件 */
  private openFile(): void {
    try {
      this.fd = fs.openSync(LOG_FILE, 'a');
      this.fileEnabled = true;

      // 写一行分隔，便于区分不同次启动
      const sep = `\n${'='.repeat(60)}\n[${new Date().toISOString()}] ${this.scope} started (PID: ${process.pid})\n${'='.repeat(60)}\n`;
      fs.writeSync(this.fd, sep);
    } catch {
      // 无法打开日志文件，仅输出到 stderr
      this.fd = null;
      this.fileEnabled = false;
    }
  }

  /** 关闭日志文件 */
  close(): void {
    if (this.fd !== null) {
      try { fs.closeSync(this.fd); } catch {}
      this.fd = null;
    }
  }
}

/** 子 logger，共享父级的写入通道 */
class ChildLogger {
  constructor(private parent: Logger, private subscope: string) {}

  debug(msg: string, ...args: any[]): void { this.parent.write('debug', `[${this.subscope}] ${msg}`, args); }
  info(msg: string, ...args: any[]): void { this.parent.write('info', `[${this.subscope}] ${msg}`, args); }
  warn(msg: string, ...args: any[]): void { this.parent.write('warn', `[${this.subscope}] ${msg}`, args); }
  error(msg: string, ...args: any[]): void { this.parent.write('error', `[${this.subscope}] ${msg}`, args); }
}

/** 全局单例 */
export const logger = new Logger();

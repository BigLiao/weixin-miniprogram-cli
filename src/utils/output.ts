/**
 * 输出工具 - 彩色输出和格式化
 */

import chalk from 'chalk';

export function success(msg: string): string {
  return chalk.green('✅ ') + msg;
}

export function error(msg: string): string {
  return chalk.red('❌ ') + msg;
}

export function warn(msg: string): string {
  return chalk.yellow('⚠️  ') + msg;
}

export function info(msg: string): string {
  return chalk.blue('ℹ️  ') + msg;
}

export function dim(msg: string): string {
  return chalk.dim(msg);
}

export function bold(msg: string): string {
  return chalk.bold(msg);
}

export function highlight(msg: string): string {
  return chalk.cyan(msg);
}

/**
 * 格式化表格输出
 */
export function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxRow);
  });

  const sep = colWidths.map(w => '─'.repeat(w + 2)).join('┼');
  const headerLine = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('│');
  const lines = [
    chalk.bold(headerLine),
    sep,
    ...rows.map(row =>
      row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('│')
    ),
  ];
  return lines.join('\n');
}

/**
 * 格式化 JSON 输出（带缩进和颜色）
 */
export function prettyJson(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * 截断长字符串
 */
export function truncate(str: string, maxLen: number = 80): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * 精简 JSON 对象，限制字符串长度和数组长度
 * 用于 snapshot 等场景，避免输出过长
 */
export function summarizeJson(
  obj: any,
  options: { maxStringLen?: number; maxArrayLen?: number } = {},
): any {
  const { maxStringLen = 80, maxArrayLen = 3 } = options;

  function walk(val: any): any {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string') {
      return truncate(val, maxStringLen);
    }
    if (typeof val !== 'object') return val;
    if (Array.isArray(val)) {
      const sliced = val.slice(0, maxArrayLen).map(walk);
      if (val.length > maxArrayLen) {
        sliced.push(`... 共 ${val.length} 项`);
      }
      return sliced;
    }
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      result[k] = walk(v);
    }
    return result;
  }

  return walk(obj);
}

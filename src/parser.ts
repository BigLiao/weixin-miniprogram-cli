/**
 * 命令解析器 - 将用户输入解析为命令名 + 参数对象
 */

import minimist from 'minimist';
import { ArgDef } from './registry.js';

export interface ParsedCommand {
  command: string;
  args: Record<string, any>;
  raw: string;
}

/**
 * 解析用户输入的命令行字符串
 * 例如: `click --uid "button.submit" --dblClick`
 * → { command: "click", args: { uid: "button.submit", dblClick: true } }
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return { command: '', args: {}, raw: trimmed };
  }

  // 分词（支持引号内的空格）
  const tokens = tokenize(trimmed);
  const command = tokens[0] || '';
  const rest = tokens.slice(1);

  // 使用 minimist 解析参数
  const parsed = minimist(rest, {
    string: [], // 不预设类型，后续按 ArgDef 转换
    boolean: [],
  });

  // 提取参数（排除 minimist 的 _ 数组）
  const args: Record<string, any> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === '_') continue;
    args[key] = value;
  }

  // 位置参数作为 _positional
  if (parsed._.length > 0) {
    args._positional = parsed._;
  }

  return { command, args, raw: trimmed };
}

/**
 * 根据 ArgDef 定义对参数进行类型转换和验证
 */
export function coerceArgs(args: Record<string, any>, defs: ArgDef[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (const def of defs) {
    // 支持别名
    let value = args[def.name] ?? (def.alias ? args[def.alias] : undefined);

    if (value === undefined) {
      if (def.required) {
        throw new Error(`缺少必需参数: --${def.name}`);
      }
      if (def.default !== undefined) {
        result[def.name] = def.default;
      }
      continue;
    }

    // 类型转换
    switch (def.type) {
      case 'number':
        value = Number(value);
        if (isNaN(value)) {
          throw new Error(`参数 --${def.name} 应为数字`);
        }
        break;
      case 'boolean':
        if (typeof value === 'string') {
          value = value === 'true' || value === '1' || value === 'yes';
        } else {
          value = Boolean(value);
        }
        break;
      case 'json':
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch {
            throw new Error(`参数 --${def.name} 应为有效的 JSON`);
          }
        }
        break;
      case 'string':
        value = String(value);
        break;
    }

    result[def.name] = value;
  }

  return result;
}

/**
 * 分词：支持单引号和双引号
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

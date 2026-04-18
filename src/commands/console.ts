/**
 * Console 监控命令组 (2个)
 * console, console-detail
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const listConsoleMessages: CommandDef = defineCommand({
  name: 'console',
  description: '列出 Console 消息（短格式，支持分页和过滤）',
  category: 'Console 监控',
  args: [
    { name: 'pageSize', type: 'number', default: 50, description: '每页数量' },
    { name: 'pageIdx', type: 'number', default: 0, description: '页码（从 0 开始）' },
    { name: 'types', type: 'string', description: '消息类型过滤（逗号分隔: log,error,warn,info,debug,exception）' },
  ],
  handler: async (args, ctx) => {
    if (!ctx.consoleListening) {
      return out.warn('Console 监听未启动。请先执行 launch 启动 automator');
    }

    let messages = [...ctx.consoleMessages];

    // 类型过滤
    if (args.types) {
      const typeFilter = String(args.types).split(',').map(t => t.trim());
      messages = messages.filter(m => typeFilter.includes(m.type));
    }

    const total = messages.length;
    const pageSize = args.pageSize || 50;
    const pageIdx = args.pageIdx || 0;
    const start = pageIdx * pageSize;
    const paged = messages.slice(start, start + pageSize);

    if (paged.length === 0) {
      return out.info(`没有 Console 消息 (总计: ${total})`);
    }

    const lines = [
      out.info(`Console 消息 (第 ${pageIdx + 1} 页, ${paged.length}/${total} 条)`),
      '',
    ];

    for (const msg of paged) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const typeColor = msg.type === 'error' || msg.type === 'exception'
        ? out.error(msg.type)
        : msg.type === 'warn'
          ? out.warn(msg.type)
          : out.dim(msg.type);

      const preview = msg.args.map(a =>
        typeof a === 'string' ? a : JSON.stringify(a)
      ).join(' ');

      lines.push(`  [${msg.msgid}] ${time} ${typeColor} ${out.truncate(preview, 60)}`);
    }

    if (total > start + pageSize) {
      lines.push('');
      lines.push(out.dim(`  还有 ${total - start - pageSize} 条，使用 --pageIdx ${pageIdx + 1} 查看下一页`));
    }

    return lines.join('\n');
  },
});

export const getConsoleMessage: CommandDef = defineCommand({
  name: 'console-detail',
  description: '获取 Console 消息详情（通过 msgid）',
  category: 'Console 监控',
  args: [
    { name: 'msgid', type: 'number', required: true, description: '消息 ID（来自 console）' },
  ],
  handler: async (args, ctx) => {
    const msg = ctx.consoleMessages.find(m => m.msgid === args.msgid);
    if (!msg) {
      return out.error(`未找到消息 ID: ${args.msgid}`);
    }

    const lines = [
      out.info(`Console 消息 #${msg.msgid}`),
      `  类型: ${msg.type}`,
      `  时间: ${new Date(msg.timestamp).toLocaleString()}`,
      `  内容:`,
    ];

    for (let i = 0; i < msg.args.length; i++) {
      const arg = msg.args[i];
      if (typeof arg === 'string') {
        lines.push(`    [${i}] ${arg}`);
      } else {
        lines.push(`    [${i}] ${out.prettyJson(arg)}`);
      }
    }

    if (msg.stack) {
      lines.push(`  堆栈:`);
      lines.push(`    ${msg.stack}`);
    }

    return lines.join('\n');
  },
});

export const consoleCommands: CommandDef[] = [
  listConsoleMessages,
  getConsoleMessage,
];

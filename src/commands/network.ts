/**
 * 网络监控命令组 (4个)
 * list_network_requests, get_network_request, stop_network_monitoring, clear_network_requests
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

/**
 * 从小程序端同步网络日志
 */
async function syncNetworkLogs(ctx: any): Promise<void> {
  if (!ctx.currentPage) return;

  try {
    const remoteLogs = await ctx.currentPage.callFunction(`() => {
      const logs = wx.__networkLogs || [];
      const result = JSON.parse(JSON.stringify(logs));
      return result;
    }`);

    if (Array.isArray(remoteLogs)) {
      // 合并新日志
      const existingUrls = new Set(ctx.networkRequests.map((r: any) => `${r.url}_${r.timestamp}`));
      for (const log of remoteLogs) {
        const key = `${log.url}_${log.timestamp}`;
        if (!existingUrls.has(key)) {
          ctx.addNetworkRequest({
            type: log.type || 'request',
            method: log.method || 'GET',
            url: log.url,
            statusCode: log.statusCode,
            requestData: log.requestData,
            requestHeader: log.requestHeader,
            responseData: log.responseData,
            responseHeader: log.responseHeader,
            timestamp: log.timestamp,
            duration: log.duration,
            success: log.success ?? false,
            errMsg: log.errMsg,
          });
        }
      }
    }
  } catch {
    // 同步失败，静默忽略
  }
}

export const listNetworkRequests: CommandDef = defineCommand({
  name: 'list_network_requests',
  description: '列出网络请求（短格式，支持分页和过滤）',
  category: '网络监控',
  args: [
    { name: 'pageSize', type: 'number', default: 50, description: '每页数量' },
    { name: 'pageIdx', type: 'number', default: 0, description: '页码（从 0 开始）' },
    { name: 'urlPattern', type: 'string', description: 'URL 匹配模式（支持正则）' },
    { name: 'successOnly', type: 'boolean', default: false, description: '只显示成功请求' },
    { name: 'failedOnly', type: 'boolean', default: false, description: '只显示失败请求' },
    { name: 'resourceTypes', type: 'string', description: '资源类型过滤（逗号分隔: request,uploadFile,downloadFile）' },
  ],
  handler: async (args, ctx) => {
    // 先从远端同步
    await syncNetworkLogs(ctx);

    let requests = [...ctx.networkRequests];

    // 过滤
    if (args.urlPattern) {
      const regex = new RegExp(args.urlPattern);
      requests = requests.filter(r => regex.test(r.url));
    }
    if (args.successOnly) {
      requests = requests.filter(r => r.success);
    }
    if (args.failedOnly) {
      requests = requests.filter(r => !r.success);
    }
    if (args.resourceTypes) {
      const types = String(args.resourceTypes).split(',').map(t => t.trim());
      requests = requests.filter(r => types.includes(r.type));
    }

    const total = requests.length;
    const pageSize = args.pageSize || 50;
    const pageIdx = args.pageIdx || 0;
    const start = pageIdx * pageSize;
    const paged = requests.slice(start, start + pageSize);

    if (paged.length === 0) {
      return out.info(`没有网络请求 (总计: ${total})`);
    }

    const lines = [
      out.info(`网络请求 (第 ${pageIdx + 1} 页, ${paged.length}/${total} 条)`),
      '',
    ];

    for (const req of paged) {
      const status = req.statusCode
        ? (req.statusCode >= 200 && req.statusCode < 300
          ? out.success(String(req.statusCode))
          : out.error(String(req.statusCode)))
        : out.dim('pending');

      const duration = req.duration ? `${req.duration}ms` : '-';
      lines.push(`  [${req.reqid}] ${req.method} ${status} ${out.truncate(req.url, 50)} (${duration})`);
    }

    if (total > start + pageSize) {
      lines.push('');
      lines.push(out.dim(`  还有 ${total - start - pageSize} 条，使用 --pageIdx ${pageIdx + 1} 查看下一页`));
    }

    return lines.join('\n');
  },
});

export const getNetworkRequest: CommandDef = defineCommand({
  name: 'get_network_request',
  description: '获取网络请求详情（通过 reqid）',
  category: '网络监控',
  args: [
    { name: 'reqid', type: 'string', required: true, description: '请求 ID（来自 list_network_requests）' },
  ],
  handler: async (args, ctx) => {
    // 先同步
    await syncNetworkLogs(ctx);

    const req = ctx.networkRequests.find(r => r.reqid === args.reqid);
    if (!req) {
      return out.error(`未找到请求 ID: ${args.reqid}`);
    }

    const lines = [
      out.info(`网络请求 #${req.reqid}`),
      `  类型: ${req.type}`,
      `  方法: ${req.method}`,
      `  URL: ${req.url}`,
      `  状态码: ${req.statusCode ?? 'N/A'}`,
      `  耗时: ${req.duration ? req.duration + 'ms' : 'N/A'}`,
      `  成功: ${req.success}`,
    ];

    if (req.errMsg) {
      lines.push(`  错误: ${req.errMsg}`);
    }

    if (req.requestHeader) {
      lines.push(`  请求头:`);
      for (const [k, v] of Object.entries(req.requestHeader)) {
        lines.push(`    ${k}: ${v}`);
      }
    }

    if (req.requestData !== undefined) {
      lines.push(`  请求体:`);
      lines.push(`    ${typeof req.requestData === 'string' ? req.requestData : out.prettyJson(req.requestData)}`);
    }

    if (req.responseHeader) {
      lines.push(`  响应头:`);
      for (const [k, v] of Object.entries(req.responseHeader as Record<string, string>)) {
        lines.push(`    ${k}: ${v}`);
      }
    }

    if (req.responseData !== undefined) {
      lines.push(`  响应体:`);
      const respStr = typeof req.responseData === 'string'
        ? req.responseData
        : out.prettyJson(req.responseData);
      lines.push(`    ${respStr.slice(0, 1000)}`);
    }

    return lines.join('\n');
  },
});

export const stopNetworkMonitoring: CommandDef = defineCommand({
  name: 'stop_network_monitoring',
  description: '停止网络监控',
  category: '网络监控',
  args: [
    { name: 'clearLogs', type: 'boolean', default: false, description: '同时清除已收集的日志' },
  ],
  handler: async (args, ctx) => {
    if (!ctx.networkListening) {
      return out.warn('网络监控未运行');
    }

    try {
      if (ctx.currentPage) {
        await ctx.currentPage.callFunction(`() => {
          wx.__networkIntercepted = false;
        }`);
      }
    } catch {}

    ctx.networkListening = false;

    if (args.clearLogs) {
      ctx.networkRequests = [];
      return out.success('网络监控已停止，日志已清除');
    }

    return out.success(`网络监控已停止 (保留 ${ctx.networkRequests.length} 条日志)`);
  },
});

export const clearNetworkRequests: CommandDef = defineCommand({
  name: 'clear_network_requests',
  description: '清除已收集的网络请求日志',
  category: '网络监控',
  args: [
    { name: 'clearRemote', type: 'boolean', default: true, description: '同时清除远端日志' },
  ],
  handler: async (args, ctx) => {
    const count = ctx.networkRequests.length;
    ctx.networkRequests = [];

    if (args.clearRemote && ctx.currentPage) {
      try {
        await ctx.currentPage.callFunction(`() => {
          wx.__networkLogs = [];
        }`);
      } catch {}
    }

    return out.success(`已清除 ${count} 条网络请求日志`);
  },
});

export const networkCommands: CommandDef[] = [
  listNetworkRequests,
  getNetworkRequest,
  stopNetworkMonitoring,
  clearNetworkRequests,
];

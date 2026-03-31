/**
 * 页面快照命令 (2个)
 * snapshot, page-data
 *
 * snapshot: 读取 WXML 源码文件 + 精简版 page.data()
 * page-data: 输出完整的 page.data()
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import * as fs from 'fs';
import * as path from 'path';

export const getPageSnapshot: CommandDef = defineCommand({
  name: 'snapshot',
  description: '获取当前页面 WXML 源码和页面数据（精简版）',
  category: '页面快照',
  args: [
    { name: 'filePath', type: 'string', description: '保存快照到文件' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();

    const lines: string[] = [];
    const page = ctx.currentPage!;

    try {
      const pagePath = page.path as string;
      lines.push(out.success('页面快照获取成功'));
      lines.push(`  页面: ${pagePath}`);
      lines.push('');

      // ========== 读取 WXML 源码文件 ==========
      const projectDir = ctx.defaultProject || ctx.lastConnectionParams?.project;
      let wxmlLoaded = false;

      if (projectDir) {
        // 尝试拼接路径读取 .wxml 文件
        const wxmlPath = path.join(projectDir, pagePath + '.wxml');
        try {
          if (fs.existsSync(wxmlPath)) {
            const wxmlContent = fs.readFileSync(wxmlPath, 'utf-8');
            lines.push('=== WXML 源码 ===');
            lines.push(wxmlContent);
            wxmlLoaded = true;
          }
        } catch {
          // 读取失败，走降级逻辑
        }
      }

      if (!wxmlLoaded) {
        lines.push(out.warn('无法读取 WXML 源文件（项目路径未知或文件不存在），仅显示页面数据'));
        lines.push('');
      }

      // ========== 获取页面数据（精简版） ==========
      try {
        const data = await page.data();
        const summarized = out.summarizeJson(data);
        lines.push('');
        lines.push('=== 页面数据 (data, 精简) ===');
        lines.push(JSON.stringify(summarized, null, 2));
        lines.push(out.dim('  完整数据请使用 page-data 命令'));
      } catch (e: any) {
        lines.push('');
        lines.push(out.warn(`获取页面数据失败: ${e.message}`));
      }

      // 保存到文件
      if (args.filePath) {
        fs.writeFileSync(args.filePath, lines.join('\n'), 'utf-8');
        lines.push('');
        lines.push(out.success(`快照已保存到: ${args.filePath}`));
      }
    } catch (e: any) {
      lines.push(out.error(`获取快照失败: ${e.message}`));
    }

    return lines.join('\n');
  },
});

export const getPageData: CommandDef = defineCommand({
  name: 'page-data',
  description: '获取当前页面完整数据 (page.data())',
  category: '页面快照',
  args: [
    { name: 'key', type: 'string', description: '只获取指定 key 的数据' },
    { name: 'filePath', type: 'string', description: '保存数据到文件' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();

    const lines: string[] = [];
    const page = ctx.currentPage!;

    try {
      const data = await page.data();
      let output: any;

      if (args.key) {
        output = data?.[args.key];
        if (output === undefined) {
          return out.warn(`data 中不存在 key: "${args.key}"\n  可用 key: ${Object.keys(data || {}).join(', ')}`);
        }
        lines.push(out.success(`data.${args.key}:`));
      } else {
        output = data;
        lines.push(out.success(`页面数据 (${page.path}):`));
      }

      const jsonStr = JSON.stringify(output, null, 2);
      lines.push(jsonStr);

      if (args.filePath) {
        fs.writeFileSync(args.filePath, jsonStr, 'utf-8');
        lines.push('');
        lines.push(out.success(`数据已保存到: ${args.filePath}`));
      }
    } catch (e: any) {
      lines.push(out.error(`获取页面数据失败: ${e.message}`));
    }

    return lines.join('\n');
  },
});

export const snapshotCommands: CommandDef[] = [
  getPageSnapshot,
  getPageData,
];

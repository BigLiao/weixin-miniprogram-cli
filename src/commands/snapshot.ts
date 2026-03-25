/**
 * 页面快照命令 (1个)
 * get_page_snapshot
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import { buildElementMap, formatSnapshotCompact } from '../utils/uid.js';

export const getPageSnapshot: CommandDef = defineCommand({
  name: 'get_page_snapshot',
  description: '获取当前页面元素快照（生成 UID 供其他命令引用）',
  category: '页面快照',
  args: [
    { name: 'format', type: 'string', default: 'compact', description: '输出格式: compact|minimal|json' },
    { name: 'maxElements', type: 'number', description: '限制返回元素数量' },
    { name: 'includePosition', type: 'boolean', default: true, description: '包含位置信息' },
    { name: 'includeAttributes', type: 'boolean', default: false, description: '包含属性信息' },
    { name: 'filePath', type: 'string', description: '保存快照到文件' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();

    const lines: string[] = [];

    try {
      // 获取页面 WXML 结构
      const wxml = await ctx.currentPage!.data();
      // 尝试获取元素树
      let elements: any[] = [];

      try {
        // 通过 $$ 获取所有顶层元素
        elements = await ctx.currentPage!.$$('page > *');
      } catch {
        // 降级：获取 page 元素
        try {
          const pageEl = await ctx.currentPage!.$('page');
          if (pageEl) elements = [pageEl];
        } catch {}
      }

      // 构建 UID 映射
      // 使用 evaluate 获取完整 DOM 树
      let domTree: any = null;
      try {
        domTree = await ctx.currentPage!.callFunction(`() => {
          function serializeNode(node) {
            if (!node) return null;
            const result = {
              tagName: node.tagName || node.nodeName || 'unknown',
              id: node.id || '',
              className: node.className || '',
              text: '',
              children: []
            };

            // 获取文本内容
            if (node.childNodes) {
              for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                if (child.nodeType === 3) { // TEXT_NODE
                  result.text += child.textContent || '';
                } else if (child.tagName) {
                  result.children.push(serializeNode(child));
                }
              }
            }
            result.text = result.text.trim();
            return result;
          }

          const root = document.querySelector('page') || document.body;
          if (!root) return { tagName: 'page', children: [] };
          return serializeNode(root);
        }`);
      } catch {
        // DOM 序列化失败，使用简化版本
      }

      if (domTree) {
        const children = domTree.children || [];
        const elementMap = buildElementMap(children);

        // 限制数量
        if (args.maxElements && elementMap.size > args.maxElements) {
          const limited = new Map<string, any>();
          let count = 0;
          for (const [k, v] of elementMap) {
            if (count >= args.maxElements) break;
            limited.set(k, v);
            count++;
          }
          ctx.elementMap = limited;
        } else {
          ctx.elementMap = elementMap;
        }

        lines.push(out.success(`快照获取成功，共 ${ctx.elementMap.size} 个元素`));
        lines.push(`  页面: ${ctx.currentPage!.path}`);
        lines.push('');

        // 输出格式
        const format = args.format || 'compact';
        if (format === 'json') {
          lines.push(out.prettyJson(domTree));
        } else if (format === 'minimal') {
          // 只输出 UID 列表
          for (const [uid, info] of ctx.elementMap) {
            lines.push(`  ${out.highlight(uid)} → ${info.selector}[${info.index}]`);
          }
        } else {
          // compact: 树形结构
          lines.push(formatSnapshotCompact(domTree));
          lines.push('');
          lines.push(out.dim('--- UID 映射 ---'));
          for (const [uid, info] of ctx.elementMap) {
            lines.push(`  ${out.highlight(uid)} → ${info.selector}[${info.index}]`);
          }
        }
      } else {
        // 降级输出
        lines.push(out.warn('无法获取完整 DOM 树，显示页面数据'));
        lines.push(out.prettyJson(wxml));
      }

      // 保存到文件
      if (args.filePath) {
        const fs = await import('fs');
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

export const snapshotCommands: CommandDef[] = [
  getPageSnapshot,
];

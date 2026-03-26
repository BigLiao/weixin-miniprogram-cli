/**
 * 页面快照命令 (1个)
 * get_page_snapshot
 *
 * 支持两种模式:
 * - tree（默认）: 通过 outerWxml() 获取 DOM 树结构，解析为层级格式
 * - flat (compact/minimal/json): 通过 page.$$('*') 逐个获取元素属性，扁平列表
 */

import { defineCommand, type CommandDef } from '../registry.js';
import { type ElementMapInfo } from '../context.js';
import { parseWxml, countNodes } from '../utils/wxml-parser.js';
import { buildElementMap, formatSnapshotTree } from '../utils/uid.js';
import * as out from '../utils/output.js';

interface ElementSnapshot {
  uid: string;
  tagName: string;
  text?: string;
  className?: string;
  id?: string;
  urls?: Record<string, string>;
  position?: { left: number; top: number; width: number; height: number };
}

/** 媒体元素标签 → 对应的 URL 属性名 */
const MEDIA_URL_ATTRS: Record<string, string[]> = {
  'image': ['src'],
  'img': ['src'],
  'video': ['src', 'poster'],
  'audio': ['src'],
  'cover-image': ['src'],
  'live-player': ['src'],
  'live-pusher': ['url'],
};

export const getPageSnapshot: CommandDef = defineCommand({
  name: 'get_page_snapshot',
  description: '获取当前页面元素快照（生成 UID 供其他命令引用）',
  category: '页面快照',
  args: [
    { name: 'format', type: 'string', default: 'tree', description: '输出格式: tree|compact|minimal|json' },
    { name: 'maxElements', type: 'number', description: '限制返回元素数量' },
    { name: 'maxDepth', type: 'number', description: '树形格式最大深度（仅 tree 格式）' },
    { name: 'includePosition', type: 'boolean', default: false, description: '包含位置信息（仅 flat 格式）' },
    { name: 'filePath', type: 'string', description: '保存快照到文件' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();

    const lines: string[] = [];
    const page = ctx.currentPage!;
    const format = args.format || 'tree';

    try {
      // 清空之前的元素映射
      ctx.elementMap.clear();

      // 等待页面稳定
      await new Promise(resolve => setTimeout(resolve, 500));

      if (format === 'tree') {
        // ========== 树形模式：通过 outerWxml 获取 DOM 树 ==========
        const treeResult = await getTreeSnapshot(page, ctx, args);
        if (treeResult) {
          lines.push(...treeResult);
        } else {
          // fallback 到 flat 模式
          lines.push(out.warn('树形模式失败，回退到 compact 模式'));
          lines.push('');
          const flatResult = await getFlatSnapshot(page, ctx, { ...args, format: 'compact' });
          lines.push(...flatResult);
        }
      } else {
        // ========== 扁平模式：原有逻辑 ==========
        const flatResult = await getFlatSnapshot(page, ctx, args);
        lines.push(...flatResult);
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

/**
 * 树形快照：通过 outerWxml() 获取完整 WXML 并解析为树
 */
async function getTreeSnapshot(
  page: any,
  ctx: any,
  args: Record<string, any>,
): Promise<string[] | null> {
  try {
    // 获取 page 根元素的 WXML
    const pageEl = await page.$('page');
    if (!pageEl) return null;

    const wxmlStr = await pageEl.outerWxml();
    if (!wxmlStr) return null;

    // 解析 WXML 为树
    const tree = parseWxml(wxmlStr);
    if (tree.length === 0) return null;

    // 生成 elementMap（DFS 顺序，与 $$() 查询一致）
    const elementMap = buildElementMap(tree);

    // 注册到 ctx
    for (const [uid, info] of elementMap) {
      ctx.elementMap.set(uid, info);
    }

    const totalNodes = countNodes(tree);
    const lines: string[] = [];
    lines.push(out.success(`快照获取成功，共 ${elementMap.size} 个元素 (树形)`));
    lines.push(`  页面: ${page.path}`);
    lines.push('');

    // 格式化输出
    const maxElements = args.maxElements || 500;
    const maxDepth = args.maxDepth || Infinity;
    const treeOutput = formatSnapshotTree(tree, { maxDepth, maxElements });
    lines.push(treeOutput);

    return lines;
  } catch {
    return null;
  }
}

/**
 * 扁平快照：原有 $$('*') + 逐个属性获取逻辑
 */
async function getFlatSnapshot(
  page: any,
  ctx: any,
  args: Record<string, any>,
): Promise<string[]> {
  const lines: string[] = [];

  // ========== 获取元素 ==========
  let childElements: any[] = [];

  // 策略1: 通配符
  try {
    childElements = await page.$$('*');
  } catch {}

  // 策略2: 降级到常用选择器
  if (childElements.length === 0) {
    const selectors = [
      'view', 'text', 'button', 'image', 'input', 'textarea', 'picker',
      'switch', 'slider', 'scroll-view', 'swiper', 'icon', 'rich-text',
      'navigator', 'form', 'checkbox', 'radio', 'cover-view',
    ];
    for (const sel of selectors) {
      try {
        const els = await page.$$(sel);
        childElements.push(...els);
      } catch {}
    }
  }

  // 策略3: page > *
  if (childElements.length === 0) {
    try {
      childElements = await page.$$('page > *');
    } catch {}
  }

  if (childElements.length === 0) {
    lines.push(out.warn('未获取到任何页面元素'));
    lines.push(out.dim('  页面可能尚未加载完成，请稍后重试'));
    return lines;
  }

  // 限制数量
  const maxElements = args.maxElements || 200;
  if (childElements.length > maxElements) {
    childElements = childElements.slice(0, maxElements);
  }

  // ========== 批量获取元素属性 ==========
  const elements: ElementSnapshot[] = [];
  const selectorIndexMap = new Map<string, number>();

  for (let i = 0; i < childElements.length; i++) {
    const element = childElements[i];
    try {
      // 并行获取属性
      const [tagNameResult, textResult, classResult, idResult, sizeResult, offsetResult] =
        await Promise.allSettled([
          Promise.resolve(element.tagName || 'unknown'),
          element.text().catch(() => ''),
          element.attribute('class').catch(() => ''),
          element.attribute('id').catch(() => ''),
          element.size().catch(() => null),
          element.offset().catch(() => null),
        ]);

      const tagName = tagNameResult.status === 'fulfilled' ? tagNameResult.value : 'unknown';
      const text = textResult.status === 'fulfilled' ? textResult.value : '';
      const className = classResult.status === 'fulfilled' ? classResult.value : '';
      const id = idResult.status === 'fulfilled' ? idResult.value : '';
      const size = sizeResult.status === 'fulfilled' ? sizeResult.value : null;
      const offset = offsetResult.status === 'fulfilled' ? offsetResult.value : null;

      // 生成选择器 / UID
      let baseSelector = tagName;
      if (id) {
        baseSelector = `${tagName}#${id}`;
      } else if (className) {
        const firstClass = String(className).trim().split(/\s+/)[0];
        if (firstClass) baseSelector = `${tagName}.${firstClass}`;
      }

      // 处理重复选择器：加索引
      const count = selectorIndexMap.get(baseSelector) || 0;
      selectorIndexMap.set(baseSelector, count + 1);
      const uid = count > 0 ? `${baseSelector}[${count}]` : baseSelector;

      // 注册到 elementMap
      ctx.elementMap.set(uid, { selector: baseSelector, index: count });

      // 构建快照
      const snap: ElementSnapshot = { uid, tagName };
      if (text && text.trim()) snap.text = text.trim().slice(0, 100);
      if (className) snap.className = String(className).trim();
      if (id) snap.id = id;

      // 媒体元素获取 URL 属性
      const mediaAttrs = MEDIA_URL_ATTRS[tagName];
      if (mediaAttrs) {
        const urls: Record<string, string> = {};
        for (const attr of mediaAttrs) {
          try {
            const val = await element.attribute(attr).catch(() => '');
            if (val) urls[attr] = val;
          } catch {}
        }
        if (Object.keys(urls).length > 0) snap.urls = urls;
      }

      if (size && offset) {
        snap.position = {
          left: Math.round(offset.left),
          top: Math.round(offset.top),
          width: Math.round(size.width),
          height: Math.round(size.height),
        };
      }

      elements.push(snap);
    } catch {
      // 跳过获取失败的元素
    }
  }

  // ========== 格式化输出 ==========
  lines.push(out.success(`快照获取成功，共 ${elements.length} 个元素`));
  lines.push(`  页面: ${page.path}`);
  lines.push('');

  const format = args.format || 'compact';

  if (format === 'json') {
    lines.push(out.prettyJson({ path: page.path, elements }));
  } else if (format === 'minimal') {
    for (const el of elements) {
      const textPart = el.text ? ` "${truncate(el.text, 40)}"` : '';
      const urlPart = formatUrls(el.urls);
      lines.push(`  ${out.highlight(el.uid)} ${el.tagName}${textPart}${urlPart}`);
    }
  } else {
    // compact（默认）
    for (const el of elements) {
      const parts = [`uid=${out.highlight(el.uid)}`, el.tagName];
      if (el.text) parts.push(`"${truncate(el.text, 40)}"`);
      if (el.urls) {
        for (const [attr, val] of Object.entries(el.urls)) {
          parts.push(`${attr}=${val}`);
        }
      }
      if (args.includePosition && el.position) {
        parts.push(`pos=[${el.position.left},${el.position.top}]`);
        parts.push(`size=[${el.position.width}x${el.position.height}]`);
      }
      lines.push(`  ${parts.join(' ')}`);
    }
  }

  return lines;
}

function formatUrls(urls?: Record<string, string>): string {
  if (!urls) return '';
  const parts = Object.entries(urls).map(([attr, val]) => `${attr}=${val}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\n/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 3) + '...';
}

export const snapshotCommands: CommandDef[] = [
  getPageSnapshot,
];

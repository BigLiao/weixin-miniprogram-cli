/**
 * UID 生成工具 - 为页面元素生成稳定的 CSS 选择器路径
 *
 * 优先级: id > class > nth-child
 */

import { ElementMapInfo } from '../context.js';
import { type WxmlNode } from './wxml-parser.js';

/** 需要跳过的无意义容器标签（不生成 UID） */
const SKIP_TAGS = new Set(['page', 'body']);

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

/** 同一选择器最多展示的元素数量 */
const MAX_SAME_SELECTOR = 8;

/**
 * 从 WxmlNode 树生成 UID 映射
 * @param nodes - 解析后的 WXML 节点树
 * @returns UID → ElementMapInfo 映射
 */
export function buildElementMap(nodes: WxmlNode[]): Map<string, ElementMapInfo> {
  const map = new Map<string, ElementMapInfo>();
  const selectorCount = new Map<string, number>();

  function walk(node: WxmlNode): void {
    if (!node || !node.tagName) return;

    // 跳过 page/body 容器
    if (!SKIP_TAGS.has(node.tagName)) {
      const selector = buildSelectorFromWxml(node);
      const count = selectorCount.get(selector) || 0;
      selectorCount.set(selector, count + 1);

      if (count < MAX_SAME_SELECTOR) {
        const uid = count > 0 ? `${selector}:${count}` : selector;
        map.set(uid, { selector, index: count });
        (node as any)._uid = uid;
      } else {
        // 超限：标记整棵子树为已省略，不注册到 elementMap
        markSkipped(node, selector, count + 1);
        return; // 不再递归子节点（markSkipped 内部已处理）
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  /** 标记节点为已省略（不递归子树） */
  function markSkipped(node: WxmlNode, selector: string, _total: number): void {
    (node as any)._uid = undefined;
    (node as any)._skipped = selector;
  }

  for (const node of nodes) {
    walk(node);
  }

  // 第二遍：回填最终 total 到所有被省略的节点
  function patchTotal(node: WxmlNode): void {
    if ((node as any)._skipped) {
      (node as any)._skippedTotal = selectorCount.get((node as any)._skipped) || 0;
    }
    for (const child of node.children) {
      patchTotal(child);
    }
  }
  for (const node of nodes) {
    patchTotal(node);
  }

  return map;
}

/**
 * 从 WxmlNode 构建选择器
 */
function buildSelectorFromWxml(node: WxmlNode): string {
  const tag = node.tagName || 'view';
  const id = node.attributes?.id;
  const className = node.attributes?.class;

  // 优先用 id
  if (id) {
    return `${tag}#${id}`;
  }

  // 其次用有意义的 class（取第一个非 bar--/icon--/search-- 前缀的 class）
  if (className) {
    const classes = className.trim().split(/\s+/).filter(Boolean);
    // 过滤掉 BEM 修饰符前缀（如 bar--xxx, icon--xxx）
    const meaningful = classes.find(c => !c.includes('--')) || classes[0];
    if (meaningful) {
      return `${tag}.${meaningful}`;
    }
  }

  // 最后用 tag name
  return tag;
}

/**
 * 将 WxmlNode 树格式化为带 UID 标注的缩进树
 *
 * 输出示例:
 * [view.container] <view class="container">
 *   [text.title] <text class="title"> "Hello World"
 *   [view.list] <view class="list">
 *     [view.item] <view class="item"> "Item 1"
 */
export function formatSnapshotTree(
  nodes: WxmlNode[],
  options: { maxDepth?: number; maxElements?: number } = {},
): string {
  const { maxDepth = Infinity, maxElements = 500 } = options;
  const lines: string[] = [];
  let elementCount = 0;
  // 记录已输出过省略提示的 selector，避免重复
  const skippedShown = new Set<string>();

  function walk(node: WxmlNode, depth: number): void {
    if (!node.tagName || elementCount >= maxElements) return;

    const indent = '  '.repeat(depth);
    const uid = (node as any)._uid as string | undefined;
    const skippedSelector = (node as any)._skipped as string | undefined;

    // 跳过 page/body 容器，但继续遍历子节点
    if (SKIP_TAGS.has(node.tagName)) {
      for (const child of node.children) {
        walk(child, depth);
      }
      return;
    }

    // 被省略的重复元素：只输出一次汇总提示，跳过整棵子树
    if (skippedSelector) {
      if (!skippedShown.has(skippedSelector)) {
        skippedShown.add(skippedSelector);
        const total = (node as any)._skippedTotal || '?';
        lines.push(`${indent}[... ${skippedSelector} 共 ${total} 个，已展示 ${MAX_SAME_SELECTOR} 个]`);
        elementCount++;
      }
      return; // 不递归子节点
    }

    elementCount++;

    const textPart = node.text ? ` "${truncateText(node.text, 40)}"` : '';
    const uidPart = uid ? `[${uid}]` : '';
    const urlPart = getMediaUrlPart(node);

    lines.push(`${indent}${uidPart}${textPart}${urlPart}`);

    // 深度限制
    if (depth >= maxDepth) {
      if (node.children.length > 0) {
        lines.push(`${indent}  ... (${node.children.length} children)`);
      }
      return;
    }

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  for (const node of nodes) {
    walk(node, 0);
  }

  if (elementCount >= maxElements) {
    lines.push(`  ... (已达 ${maxElements} 个元素上限)`);
  }

  return lines.join('\n');
}

/**
 * 格式化快照节点为紧凑文本（旧版兼容）
 */
export function formatSnapshotCompact(node: any, depth: number = 0): string {
  if (!node) return '';

  const indent = '  '.repeat(depth);
  const tag = node.tagName || 'unknown';
  const attrs: string[] = [];

  if (node.id) attrs.push(`id="${node.id}"`);
  if (node.className) attrs.push(`class="${node.className}"`);
  if (node.text) attrs.push(`text="${truncateText(node.text)}"`);

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  let result = `${indent}<${tag}${attrStr}>\n`;

  const children = node.childNodes || node.children || [];
  for (const child of children) {
    if (child && child.tagName) {
      result += formatSnapshotCompact(child, depth + 1);
    }
  }

  return result;
}

/**
 * 提取媒体元素的 URL 属性，拼接为后缀字符串
 */
function getMediaUrlPart(node: WxmlNode): string {
  const attrNames = MEDIA_URL_ATTRS[node.tagName];
  if (!attrNames || !node.attributes) return '';

  const urls: string[] = [];
  for (const attr of attrNames) {
    const val = node.attributes[attr];
    if (val) urls.push(`${attr}=${val}`);
  }
  return urls.length > 0 ? ` (${urls.join(', ')})` : '';
}

function truncateText(text: string, max: number = 50): string {
  const clean = text.replace(/\n/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 3) + '...';
}

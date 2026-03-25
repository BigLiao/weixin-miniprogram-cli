/**
 * UID 生成工具 - 为页面元素生成稳定的 CSS 选择器路径
 *
 * 优先级: id > class > nth-child
 */

import { ElementMapInfo } from '../context.js';

/**
 * 从 WXML 节点树生成 UID 映射
 * @param nodes - 页面 WXML 节点树
 * @returns UID → ElementMapInfo 映射
 */
export function buildElementMap(nodes: any[]): Map<string, ElementMapInfo> {
  const map = new Map<string, ElementMapInfo>();
  const selectorCount = new Map<string, number>();

  function walk(node: any, parentPath: string = ''): void {
    if (!node || !node.tagName) return;

    const selector = buildSelector(node, parentPath);
    const count = selectorCount.get(selector) || 0;
    selectorCount.set(selector, count + 1);

    const uid = count > 0 ? `${selector}[${count}]` : selector;
    map.set(uid, { selector, index: count });

    // 递归子节点
    if (node.childNodes && Array.isArray(node.childNodes)) {
      for (const child of node.childNodes) {
        walk(child, selector);
      }
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child, selector);
      }
    }
  }

  if (Array.isArray(nodes)) {
    for (const node of nodes) {
      walk(node);
    }
  }

  return map;
}

/**
 * 构建单个元素的选择器
 */
function buildSelector(node: any, parentPath: string): string {
  const tag = node.tagName || 'view';

  // 优先用 id
  if (node.id) {
    return `#${node.id}`;
  }

  // 其次用有意义的 class
  if (node.className) {
    const classes = String(node.className).trim().split(/\s+/).filter(Boolean);
    if (classes.length > 0) {
      const cls = classes[0]; // 取第一个 class
      return `${tag}.${cls}`;
    }
  }

  // 最后用 tag name
  return tag;
}

/**
 * 格式化快照节点为紧凑文本
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

function truncateText(text: string, max: number = 50): string {
  const clean = text.replace(/\n/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 3) + '...';
}

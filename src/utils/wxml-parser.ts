/**
 * 轻量 WXML 解析器 - 将 WXML 字符串解析为树结构
 * 无外部依赖，处理微信小程序 WXML 标记
 */

export interface WxmlNode {
  tagName: string;
  attributes: Record<string, string>;
  children: WxmlNode[];
  text?: string;
}

/** 自闭合标签 */
const VOID_TAGS = new Set([
  'input', 'image', 'img', 'br', 'hr', 'area', 'col', 'embed',
  'source', 'track', 'wbr', 'import', 'include',
]);

/**
 * 将 WXML 字符串解析为节点树
 */
export function parseWxml(wxml: string): WxmlNode[] {
  const roots: WxmlNode[] = [];
  const stack: WxmlNode[] = [];
  let pos = 0;

  while (pos < wxml.length) {
    // 跳过注释 <!-- ... -->
    if (wxml.startsWith('<!--', pos)) {
      const end = wxml.indexOf('-->', pos + 4);
      pos = end === -1 ? wxml.length : end + 3;
      continue;
    }

    // 闭标签 </tag>
    if (wxml.startsWith('</', pos)) {
      const end = wxml.indexOf('>', pos + 2);
      if (end === -1) break;
      // 弹出栈
      if (stack.length > 0) {
        stack.pop();
      }
      pos = end + 1;
      continue;
    }

    // 开标签 <tag ...> 或自闭合 <tag ... />
    if (wxml[pos] === '<' && pos + 1 < wxml.length && wxml[pos + 1] !== '!') {
      const tagResult = parseOpenTag(wxml, pos);
      if (!tagResult) {
        // 无法解析，跳过这个 <
        pos++;
        continue;
      }

      const { node, end, selfClosing } = tagResult;
      pos = end;

      const parent = stack.length > 0 ? stack[stack.length - 1] : null;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }

      if (!selfClosing && !VOID_TAGS.has(node.tagName)) {
        stack.push(node);
      }
      continue;
    }

    // 文本节点
    const nextTag = wxml.indexOf('<', pos);
    const textEnd = nextTag === -1 ? wxml.length : nextTag;
    const text = wxml.slice(pos, textEnd).trim();

    if (text && stack.length > 0) {
      const parent = stack[stack.length - 1];
      // 合并到父节点的 text 属性
      if (parent.text) {
        parent.text += ' ' + text;
      } else {
        parent.text = text;
      }
    }

    pos = textEnd;
  }

  return roots;
}

/**
 * 解析开标签，返回节点和结束位置
 */
function parseOpenTag(wxml: string, start: number): { node: WxmlNode; end: number; selfClosing: boolean } | null {
  // 跳过 <
  let pos = start + 1;

  // 读取 tagName
  const tagStart = pos;
  while (pos < wxml.length && !/[\s/>]/.test(wxml[pos])) pos++;
  const tagName = wxml.slice(tagStart, pos).toLowerCase();
  if (!tagName) return null;

  // 解析属性
  const attributes: Record<string, string> = {};
  while (pos < wxml.length) {
    // 跳过空白
    while (pos < wxml.length && /\s/.test(wxml[pos])) pos++;

    // 自闭合 /> 或闭合 >
    if (wxml[pos] === '/') {
      if (wxml[pos + 1] === '>') {
        return { node: { tagName, attributes, children: [] }, end: pos + 2, selfClosing: true };
      }
    }
    if (wxml[pos] === '>') {
      return { node: { tagName, attributes, children: [] }, end: pos + 1, selfClosing: false };
    }

    // 读取属性名
    const attrNameStart = pos;
    while (pos < wxml.length && !/[\s=/>]/.test(wxml[pos])) pos++;
    const attrName = wxml.slice(attrNameStart, pos);
    if (!attrName) { pos++; continue; }

    // 跳过空白
    while (pos < wxml.length && /\s/.test(wxml[pos])) pos++;

    // 检查 =
    if (wxml[pos] === '=') {
      pos++; // 跳过 =
      while (pos < wxml.length && /\s/.test(wxml[pos])) pos++;

      // 读取属性值
      const quote = wxml[pos];
      if (quote === '"' || quote === "'") {
        pos++; // 跳过引号
        const valStart = pos;
        while (pos < wxml.length && wxml[pos] !== quote) pos++;
        attributes[attrName] = wxml.slice(valStart, pos);
        pos++; // 跳过结束引号
      } else {
        // 无引号属性值
        const valStart = pos;
        while (pos < wxml.length && !/[\s>]/.test(wxml[pos])) pos++;
        attributes[attrName] = wxml.slice(valStart, pos);
      }
    } else {
      // 布尔属性（无值）
      attributes[attrName] = '';
    }
  }

  // 到达字符串末尾
  return { node: { tagName, attributes, children: [] }, end: pos, selfClosing: false };
}

/**
 * 统计树中的节点总数
 */
export function countNodes(nodes: WxmlNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.children);
  }
  return count;
}

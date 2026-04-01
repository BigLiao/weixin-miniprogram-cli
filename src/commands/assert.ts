/**
 * 断言验证命令组 (3个)
 * assert-text, assert-attr, assert-state
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const assertText: CommandDef = defineCommand({
  name: 'assert-text',
  description: '断言元素文本内容',
  category: '断言验证',
  args: [
    { name: 'selector', type: 'string', required: true, description: 'CSS 选择器' },
    { name: 'text', type: 'string', description: '精确匹配文本' },
    { name: 'textContains', type: 'string', description: '包含文本' },
    { name: 'textMatches', type: 'string', description: '正则匹配模式' },
  ],
  handler: async (args, ctx) => {
    const el = await ctx.getElementBySelector(args.selector);
    const actualText = await el.text() || '';

    if (args.text !== undefined) {
      if (actualText === args.text) {
        return out.success(`文本匹配: "${actualText}" === "${args.text}"`);
      }
      return out.error(`文本不匹配:\n  期望: "${args.text}"\n  实际: "${actualText}"`);
    }

    if (args.textContains) {
      if (actualText.includes(args.textContains)) {
        return out.success(`文本包含: "${args.textContains}" ∈ "${out.truncate(actualText)}"`);
      }
      return out.error(`文本不包含:\n  期望包含: "${args.textContains}"\n  实际: "${out.truncate(actualText)}"`);
    }

    if (args.textMatches) {
      const regex = new RegExp(args.textMatches);
      if (regex.test(actualText)) {
        return out.success(`文本匹配正则: /${args.textMatches}/ ← "${out.truncate(actualText)}"`);
      }
      return out.error(`文本不匹配正则:\n  模式: /${args.textMatches}/\n  实际: "${out.truncate(actualText)}"`);
    }

    return `${args.selector} 文本内容: "${actualText}"`;
  },
});

export const assertAttribute: CommandDef = defineCommand({
  name: 'assert-attr',
  description: '断言元素属性值',
  category: '断言验证',
  args: [
    { name: 'selector', type: 'string', required: true, description: 'CSS 选择器' },
    { name: 'key', type: 'string', required: true, description: '属性名' },
    { name: 'value', type: 'string', required: true, description: '期望属性值' },
  ],
  handler: async (args, ctx) => {
    const el = await ctx.getElementBySelector(args.selector);
    const actualValue = await el.attribute(args.key);
    const actualStr = String(actualValue ?? '');

    if (actualStr === args.value) {
      return out.success(`属性匹配: ${args.selector}.${args.key} === "${args.value}"`);
    }
    return out.error(`属性不匹配:\n  ${args.selector}.${args.key}\n  期望: "${args.value}"\n  实际: "${actualStr}"`);
  },
});

export const assertState: CommandDef = defineCommand({
  name: 'assert-state',
  description: '断言元素状态（可见性、启用、选中、焦点）',
  category: '断言验证',
  args: [
    { name: 'selector', type: 'string', required: true, description: 'CSS 选择器' },
    { name: 'visible', type: 'boolean', description: '期望可见状态' },
    { name: 'enabled', type: 'boolean', description: '期望启用状态' },
    { name: 'checked', type: 'boolean', description: '期望选中状态（checkbox/radio）' },
    { name: 'focused', type: 'boolean', description: '期望焦点状态' },
  ],
  handler: async (args, ctx) => {
    const el = await ctx.getElementBySelector(args.selector);
    const results: string[] = [];
    let allPassed = true;

    if (args.visible !== undefined) {
      try {
        const style = await el.style('display');
        const isVisible = style !== 'none';
        if (isVisible === args.visible) {
          results.push(out.success(`visible: ${isVisible}`));
        } else {
          results.push(out.error(`visible: 期望 ${args.visible}, 实际 ${isVisible}`));
          allPassed = false;
        }
      } catch (e: any) {
        results.push(out.warn(`visible: 检查失败 - ${e.message}`));
        allPassed = false;
      }
    }

    if (args.enabled !== undefined) {
      try {
        const disabled = await el.attribute('disabled');
        const isEnabled = !disabled || disabled === 'false';
        if (isEnabled === args.enabled) {
          results.push(out.success(`enabled: ${isEnabled}`));
        } else {
          results.push(out.error(`enabled: 期望 ${args.enabled}, 实际 ${isEnabled}`));
          allPassed = false;
        }
      } catch (e: any) {
        results.push(out.warn(`enabled: 检查失败 - ${e.message}`));
        allPassed = false;
      }
    }

    if (args.checked !== undefined) {
      try {
        const checked = await el.attribute('checked');
        const isChecked = checked === 'true' || checked === true;
        if (isChecked === args.checked) {
          results.push(out.success(`checked: ${isChecked}`));
        } else {
          results.push(out.error(`checked: 期望 ${args.checked}, 实际 ${isChecked}`));
          allPassed = false;
        }
      } catch (e: any) {
        results.push(out.warn(`checked: 检查失败 - ${e.message}`));
        allPassed = false;
      }
    }

    if (args.focused !== undefined) {
      try {
        const focus = await el.attribute('focus');
        const isFocused = focus === 'true' || focus === true;
        if (isFocused === args.focused) {
          results.push(out.success(`focused: ${isFocused}`));
        } else {
          results.push(out.error(`focused: 期望 ${args.focused}, 实际 ${isFocused}`));
          allPassed = false;
        }
      } catch (e: any) {
        results.push(out.warn(`focused: 检查失败 - ${e.message}`));
        allPassed = false;
      }
    }

    if (results.length === 0) {
      return out.warn('请至少指定一个状态检查: --visible, --enabled, --checked, --focused');
    }

    const header = allPassed
      ? out.success(`断言通过: ${args.selector}`)
      : out.error(`断言失败: ${args.selector}`);

    return [header, ...results].join('\n');
  },
});

export const assertCommands: CommandDef[] = [
  assertText,
  assertAttribute,
  assertState,
];

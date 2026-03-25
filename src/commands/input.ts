/**
 * 交互操作命令组 (4个)
 * click, input_text, get_value, set_form_control
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const click: CommandDef = defineCommand({
  name: 'click',
  description: '点击页面元素',
  category: '交互操作',
  args: [
    { name: 'uid', type: 'string', required: true, description: '元素 UID（来自 get_page_snapshot）' },
    { name: 'dblClick', type: 'boolean', default: false, description: '是否双击' },
  ],
  handler: async (args, ctx) => {
    const el = await ctx.getElementByUid(args.uid);
    if (args.dblClick) {
      await el.tap();
      await new Promise(r => setTimeout(r, 100));
      await el.tap();
      return out.success(`双击: ${args.uid}`);
    } else {
      await el.tap();
      return out.success(`点击: ${args.uid}`);
    }
  },
});

export const inputText: CommandDef = defineCommand({
  name: 'input_text',
  description: '向 input/textarea 元素输入文本',
  category: '交互操作',
  args: [
    { name: 'uid', type: 'string', required: true, description: '元素 UID' },
    { name: 'text', type: 'string', required: true, description: '要输入的文本' },
    { name: 'clear', type: 'boolean', default: false, description: '输入前清空' },
    { name: 'append', type: 'boolean', default: false, description: '追加到已有内容后' },
  ],
  handler: async (args, ctx) => {
    const el = await ctx.getElementByUid(args.uid);

    if (args.clear) {
      try {
        await el.input('');
      } catch {}
    }

    if (args.append) {
      try {
        const current = await el.value();
        await el.input((current || '') + args.text);
        return out.success(`追加文本到 ${args.uid}: "${args.text}"`);
      } catch {
        // 降级为直接输入
      }
    }

    await el.input(args.text);
    return out.success(`输入文本到 ${args.uid}: "${args.text}"`);
  },
});

export const getValue: CommandDef = defineCommand({
  name: 'get_value',
  description: '获取元素的值或文本内容',
  category: '交互操作',
  args: [
    { name: 'uid', type: 'string', required: true, description: '元素 UID' },
    { name: 'attribute', type: 'string', description: '要获取的属性名' },
  ],
  handler: async (args, ctx) => {
    const el = await ctx.getElementByUid(args.uid);
    const lines: string[] = [];

    if (args.attribute) {
      const attrVal = await el.attribute(args.attribute);
      lines.push(`${args.uid}.${args.attribute} = ${JSON.stringify(attrVal)}`);
    } else {
      // 尝试获取 value，降级到 text
      let value: any;
      try {
        value = await el.value();
      } catch {
        value = await el.text();
      }
      lines.push(`${args.uid} = ${JSON.stringify(value)}`);
    }

    return lines.join('\n');
  },
});

export const setFormControl: CommandDef = defineCommand({
  name: 'set_form_control',
  description: '设置表单控件值（picker、switch、slider 等）',
  category: '交互操作',
  args: [
    { name: 'uid', type: 'string', required: true, description: '元素 UID' },
    { name: 'value', type: 'json', required: true, description: '要设置的值' },
    { name: 'trigger', type: 'string', default: 'change', description: '触发的事件类型' },
  ],
  handler: async (args, ctx) => {
    const el = await ctx.getElementByUid(args.uid);

    try {
      await el.trigger(args.trigger || 'change', { value: args.value });
      return out.success(`设置 ${args.uid} 值为: ${JSON.stringify(args.value)}`);
    } catch (e: any) {
      // 降级：尝试直接 input
      try {
        await el.input(String(args.value));
        return out.success(`设置 ${args.uid} 值为: ${JSON.stringify(args.value)} (via input)`);
      } catch {
        return out.error(`设置失败: ${e.message}`);
      }
    }
  },
});

export const inputCommands: CommandDef[] = [
  click,
  inputText,
  getValue,
  setFormControl,
];

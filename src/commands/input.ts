/**
 * 交互操作命令组 (7个)
 * click, fill, value, set-value, hover, press, drag
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';

export const click: CommandDef = defineCommand({
  name: 'click',
  description: '点击页面元素',
  category: '交互操作',
  args: [
    { name: 'uid', type: 'string', required: true, description: '元素 UID（来自 snapshot）' },
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
  name: 'fill',
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
  name: 'value',
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
  name: 'set-value',
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

export const hover: CommandDef = defineCommand({
  name: 'hover',
  description: '长按元素（模拟 hover / longpress）',
  category: '交互操作',
  args: [
    { name: 'uid', type: 'string', required: true, description: '元素 UID' },
  ],
  handler: async (args, ctx) => {
    const el = await ctx.getElementByUid(args.uid);
    await el.longpress();
    return out.success(`长按: ${args.uid}`);
  },
});

export const press: CommandDef = defineCommand({
  name: 'press',
  description: '触发键盘按键事件',
  category: '交互操作',
  args: [
    { name: 'key', type: 'string', required: true, description: '按键名称（如 Enter, Backspace, Tab）' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();
    const key = args.key;

    // 通过 page.evaluate 触发 keyboard input 事件
    await ctx.currentPage!.evaluate((k: string) => {
      const event = new KeyboardEvent('keydown', {
        key: k,
        code: k,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      const upEvent = new KeyboardEvent('keyup', {
        key: k,
        code: k,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(upEvent);
    }, key);

    return out.success(`按键: ${key}`);
  },
});

export const drag: CommandDef = defineCommand({
  name: 'drag',
  description: '拖拽元素（从一个元素拖到另一个元素）',
  category: '交互操作',
  args: [
    { name: 'fromUid', type: 'string', required: true, description: '起始元素 UID' },
    { name: 'toUid', type: 'string', required: true, description: '目标元素 UID' },
    { name: 'steps', type: 'number', default: 10, description: '拖拽中间步数' },
    { name: 'duration', type: 'number', default: 500, description: '拖拽持续时间(ms)' },
  ],
  handler: async (args, ctx) => {
    const fromEl = await ctx.getElementByUid(args.fromUid);
    const toEl = await ctx.getElementByUid(args.toUid);

    // 获取两个元素的位置
    const [fromOffset, fromSize, toOffset, toSize] = await Promise.all([
      fromEl.offset(),
      fromEl.size(),
      toEl.offset(),
      toEl.size(),
    ]);

    const fromX = fromOffset.left + fromSize.width / 2;
    const fromY = fromOffset.top + fromSize.height / 2;
    const toX = toOffset.left + toSize.width / 2;
    const toY = toOffset.top + toSize.height / 2;

    const steps = args.steps || 10;
    const duration = args.duration || 500;
    const stepDelay = duration / steps;

    // 通过 touch 事件链模拟拖拽
    await ctx.currentPage!.evaluate(
      (params: { fromX: number; fromY: number; toX: number; toY: number; steps: number; stepDelay: number }) => {
        return new Promise<void>((resolve) => {
          const { fromX, fromY, toX, toY, steps, stepDelay } = params;

          // touchstart
          const startTouch = new Touch({ identifier: 1, target: document, clientX: fromX, clientY: fromY });
          document.dispatchEvent(new TouchEvent('touchstart', { touches: [startTouch], changedTouches: [startTouch], bubbles: true }));

          let step = 0;
          const interval = setInterval(() => {
            step++;
            const ratio = step / steps;
            const x = fromX + (toX - fromX) * ratio;
            const y = fromY + (toY - fromY) * ratio;

            const moveTouch = new Touch({ identifier: 1, target: document, clientX: x, clientY: y });
            document.dispatchEvent(new TouchEvent('touchmove', { touches: [moveTouch], changedTouches: [moveTouch], bubbles: true }));

            if (step >= steps) {
              clearInterval(interval);
              const endTouch = new Touch({ identifier: 1, target: document, clientX: toX, clientY: toY });
              document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [endTouch], bubbles: true }));
              resolve();
            }
          }, stepDelay);
        });
      },
      { fromX, fromY, toX, toY, steps, stepDelay },
    );

    return out.success(`拖拽: ${args.fromUid} → ${args.toUid}`);
  },
});

export const inputCommands: CommandDef[] = [
  click,
  inputText,
  getValue,
  setFormControl,
  hover,
  press,
  drag,
];

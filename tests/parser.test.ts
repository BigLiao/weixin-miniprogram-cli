import { describe, expect, it } from 'vitest';
import { coerceArgs, parseCommand } from '../src/parser.js';
import type { ArgDef } from '../src/registry.js';

describe('parseCommand', () => {
  it('parses quoted values and positional arguments', () => {
    const parsed = parseCommand('click ".login button" --delay 500 --force');

    expect(parsed).toEqual({
      command: 'click',
      args: {
        _positional: ['.login button'],
        delay: 500,
        force: true,
      },
      raw: 'click ".login button" --delay 500 --force',
    });
  });

  it('preserves escaped whitespace in positional values', () => {
    const parsed = parseCommand('open /tmp/demo\\ project --auto-port 9420');

    expect(parsed.command).toBe('open');
    expect(parsed.args._positional).toEqual(['/tmp/demo project']);
    expect(parsed.args['auto-port']).toBe(9420);
  });
});

describe('coerceArgs', () => {
  const defs: ArgDef[] = [
    { name: 'project', type: 'string', required: true, alias: 'p', description: '项目路径' },
    { name: 'autoPort', type: 'number', description: 'automator 端口' },
    { name: 'headless', type: 'boolean', default: false, description: '无头模式' },
    { name: 'payload', type: 'json', description: 'JSON 负载' },
  ];

  it('coerces alias, kebab-case and typed values', () => {
    const result = coerceArgs(
      {
        p: './examples/miniprogram-demo',
        'auto-port': '9420',
        headless: 'yes',
        payload: '{"scene":"smoke"}',
      },
      defs,
    );

    expect(result).toEqual({
      project: './examples/miniprogram-demo',
      autoPort: 9420,
      headless: true,
      payload: { scene: 'smoke' },
    });
  });

  it('applies defaults and rejects missing required arguments', () => {
    expect(() =>
      coerceArgs(
        {
          autoPort: '9420',
        },
        defs,
      ),
    ).toThrow('缺少必需参数: --project');

    expect(
      coerceArgs(
        {
          project: './demo',
        },
        defs,
      ),
    ).toEqual({
      project: './demo',
      headless: false,
    });
  });
});

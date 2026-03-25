#!/usr/bin/env node

/**
 * wx-devtools-cli - 微信开发者工具交互式 CLI 控制器
 * REPL 主入口
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { SharedContext } from './context.js';
import { registry, type CommandDef } from './registry.js';
import { parseCommand, coerceArgs } from './parser.js';
import { allCommands } from './commands/index.js';
import * as out from './utils/output.js';

// 注册所有命令
registry.registerAll(allCommands);

// 全局共享上下文
const ctx = new SharedContext();

// ==================== 内置命令 ====================

function showHelp(cmdName?: string): string {
  if (cmdName) {
    const cmd = registry.get(cmdName);
    if (!cmd) {
      return out.error(`未知命令: ${cmdName}`);
    }
    return formatCommandHelp(cmd);
  }

  // 显示所有命令
  const lines: string[] = [
    '',
    chalk.bold('  wx-devtools-cli') + chalk.dim(' — 微信开发者工具交互式 CLI'),
    '',
  ];

  const byCategory = registry.getByCategory();
  for (const [category, cmds] of byCategory) {
    lines.push(chalk.yellow(`  ${category}:`));
    for (const cmd of cmds) {
      lines.push(`    ${chalk.cyan(cmd.name.padEnd(28))} ${chalk.dim(cmd.description)}`);
    }
    lines.push('');
  }

  lines.push(chalk.yellow('  内置命令:'));
  lines.push(`    ${chalk.cyan('help [command]'.padEnd(28))} ${chalk.dim('显示帮助信息')}`);
  lines.push(`    ${chalk.cyan('exit / quit'.padEnd(28))} ${chalk.dim('退出 CLI')}`);
  lines.push(`    ${chalk.cyan('clear'.padEnd(28))} ${chalk.dim('清屏')}`);
  lines.push(`    ${chalk.cyan('status'.padEnd(28))} ${chalk.dim('显示当前连接状态')}`);
  lines.push(`    ${chalk.cyan('history'.padEnd(28))} ${chalk.dim('显示命令历史')}`);
  lines.push('');
  lines.push(chalk.dim('  示例: connect_devtools --project /path/to/project'));
  lines.push(chalk.dim('  示例: click --uid "button.submit"'));
  lines.push(chalk.dim('  示例: help connect_devtools'));
  lines.push('');

  return lines.join('\n');
}

function formatCommandHelp(cmd: CommandDef): string {
  const lines = [
    '',
    chalk.bold(`  ${cmd.name}`) + chalk.dim(` — ${cmd.description}`),
    chalk.dim(`  分类: ${cmd.category}`),
    '',
  ];

  if (cmd.args.length > 0) {
    lines.push(chalk.yellow('  参数:'));
    for (const arg of cmd.args) {
      const required = arg.required ? chalk.red('*') : ' ';
      const alias = arg.alias ? chalk.dim(` (-${arg.alias})`) : '';
      const defaultVal = arg.default !== undefined ? chalk.dim(` [默认: ${arg.default}]`) : '';
      const typeStr = chalk.dim(`<${arg.type}>`);

      lines.push(`  ${required} --${chalk.cyan(arg.name.padEnd(20))}${alias} ${typeStr} ${arg.description}${defaultVal}`);
    }
  } else {
    lines.push(chalk.dim('  无参数'));
  }

  lines.push('');

  // 使用示例
  lines.push(chalk.yellow('  示例:'));
  const example = buildExample(cmd);
  lines.push(`    ${chalk.dim('$')} ${example}`);
  lines.push('');

  return lines.join('\n');
}

function buildExample(cmd: CommandDef): string {
  const parts = [cmd.name];
  for (const arg of cmd.args) {
    if (arg.required) {
      switch (arg.type) {
        case 'string': parts.push(`--${arg.name} "value"`); break;
        case 'number': parts.push(`--${arg.name} 123`); break;
        case 'boolean': parts.push(`--${arg.name}`); break;
        case 'json': parts.push(`--${arg.name} '{"key":"value"}'`); break;
      }
    }
  }
  return parts.join(' ');
}

// ==================== REPL 主循环 ====================

const commandHistory: string[] = [];

function getPrompt(): string {
  const connected = ctx.miniProgram ? chalk.green('●') : chalk.red('○');
  const page = ctx.currentPage?.path ? chalk.dim(` ${ctx.currentPage.path}`) : '';
  return `${connected}${page} ${chalk.bold('wx>')} `;
}

async function executeCommand(input: string): Promise<void> {
  const { command, args } = parseCommand(input);

  if (!command) return;

  // 记录历史
  commandHistory.push(input);

  // 内置命令
  switch (command) {
    case 'help':
      console.log(showHelp(args._positional?.[0]));
      return;

    case 'exit':
    case 'quit':
      if (ctx.miniProgram) {
        console.log(out.dim('断开连接...'));
        try { await ctx.miniProgram.disconnect(); } catch {}
      }
      console.log(chalk.dim('再见! 👋'));
      process.exit(0);

    case 'clear':
      console.clear();
      return;

    case 'status': {
      const statusCmd = registry.get('get_connection_status');
      if (statusCmd) {
        const result = await statusCmd.handler({}, ctx);
        console.log(result);
      }
      return;
    }

    case 'history':
      if (commandHistory.length === 0) {
        console.log(out.dim('  没有命令历史'));
      } else {
        const recent = commandHistory.slice(-20);
        for (let i = 0; i < recent.length; i++) {
          console.log(chalk.dim(`  ${i + 1}. `) + recent[i]);
        }
      }
      return;
  }

  // 查找注册的命令
  const cmd = registry.get(command);
  if (!cmd) {
    console.log(out.error(`未知命令: ${command}`));
    console.log(out.dim('  输入 help 查看所有可用命令'));
    return;
  }

  try {
    // 参数类型转换
    const coerced = coerceArgs(args, cmd.args);
    // 执行命令
    const result = await cmd.handler(coerced, ctx);
    if (result) {
      console.log(result);
    }
  } catch (e: any) {
    console.log(out.error(e.message));
  }
}

// ==================== 启动 ====================

function showBanner(): void {
  console.log('');
  console.log(chalk.bold('  🔧 wx-devtools-cli v0.1.0'));
  console.log(chalk.dim('  微信开发者工具交互式 CLI 控制器'));
  console.log(chalk.dim(`  ${allCommands.length} 个命令可用，输入 help 查看帮助`));
  console.log('');
}

function startRepl(): void {
  showBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
    completer: (line: string) => {
      const trimmed = line.trim();
      // 命令补全
      const allNames = [
        ...registry.getAll().map(c => c.name),
        'help', 'exit', 'quit', 'clear', 'status', 'history',
      ];

      if (!trimmed.includes(' ')) {
        // 补全命令名
        const hits = allNames.filter(n => n.startsWith(trimmed));
        return [hits.length ? hits : allNames, trimmed];
      }

      // 补全参数名
      const parts = trimmed.split(/\s+/);
      const cmdName = parts[0];
      const lastPart = parts[parts.length - 1];
      const cmd = registry.get(cmdName);

      if (cmd && lastPart.startsWith('-')) {
        const argNames = cmd.args.map(a => `--${a.name}`);
        const hits = argNames.filter(n => n.startsWith(lastPart));
        return [hits, lastPart];
      }

      return [[], line];
    },
  });

  const prompt = () => {
    rl.question(getPrompt(), async (input) => {
      const trimmed = input.trim();
      if (trimmed) {
        await executeCommand(trimmed);
      }
      prompt();
    });
  };

  // 处理 Ctrl+C
  rl.on('SIGINT', () => {
    console.log('');
    console.log(chalk.dim('按 Ctrl+C 再次退出，或输入 exit'));
    prompt();
  });

  rl.on('close', async () => {
    if (ctx.miniProgram) {
      try { await ctx.miniProgram.disconnect(); } catch {}
    }
    console.log(chalk.dim('\n再见! 👋'));
    process.exit(0);
  });

  prompt();
}

// 支持直接传入命令作为参数（非交互模式）
const args = process.argv.slice(2);
if (args.length > 0 && args[0] !== '--repl') {
  // 非交互模式：执行单个命令
  const input = args.join(' ');
  executeCommand(input).then(() => {
    if (!ctx.miniProgram) {
      process.exit(0);
    }
    // 如果已连接，进入 REPL
    startRepl();
  }).catch((e) => {
    console.error(out.error(e.message));
    process.exit(1);
  });
} else {
  // 交互模式
  startRepl();
}

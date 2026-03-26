#!/usr/bin/env node

/**
 * wx-devtools-cli - 微信开发者工具交互式 CLI 控制器
 *
 * 支持三种模式：
 * 1. wx-devtools-cli connect <path>      — 启动 daemon + 连接（daemon 模式）
 * 2. wx-devtools-cli <command> [args]    — 通过 daemon 或本地执行
 * 3. wx-devtools-cli --repl              — 传统 REPL 模式（向后兼容）
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { SharedContext } from './context.js';
import { registry, type CommandDef } from './registry.js';
import { parseCommand, coerceArgs } from './parser.js';
import { allCommands } from './commands/index.js';
import { loadPersistedConfig } from './commands/config.js';
import * as out from './utils/output.js';
import {
  isDaemonRunning,
  sendCommand,
  startDaemon,
  stopDaemon,
  getDaemonPid,
} from './client.js';

// 注册所有命令（用于 REPL 模式和本地执行）
registry.registerAll(allCommands);

// 全局共享上下文（仅 REPL 模式使用）
const ctx = new SharedContext();

// 加载持久化配置（~/.wx-devtools-cli-config.json）
loadPersistedConfig(ctx);

// ==================== 命令分类 ====================

/**
 * 不需要 daemon 的命令（可以本地直接执行）
 */
const LOCAL_COMMANDS = new Set([
  'check_environment',
  'config',
  // ide 命令系列
  'ide open', 'ide login', 'ide islogin', 'ide preview',
  'ide auto-preview', 'ide upload', 'ide build-npm',
  'ide auto', 'ide close', 'ide quit', 'ide cache',
]);

/**
 * 内置命令（不走注册表）
 */
const BUILTIN_COMMANDS = new Set(['help', 'exit', 'quit', 'clear', 'history']);

/**
 * 判断命令是否可以本地执行
 */
function isLocalCommand(command: string, positionalArgs?: string[]): boolean {
  if (BUILTIN_COMMANDS.has(command)) return true;
  if (LOCAL_COMMANDS.has(command)) return true;
  // 检查命名空间形式
  if (positionalArgs && positionalArgs.length > 0) {
    const nsCommand = `${command} ${positionalArgs[0]}`;
    if (LOCAL_COMMANDS.has(nsCommand)) return true;
  }
  return false;
}

// ==================== 内置命令 ====================

/**
 * 构建参数简介行（用于命令总览）
 */
function buildArgsSummary(cmd: CommandDef): string {
  if (cmd.args.length === 0) return '';
  const parts: string[] = [];
  for (const arg of cmd.args) {
    if (arg.required) {
      parts.push(`<${arg.name}>*`);
    } else {
      parts.push(`--${arg.name}`);
    }
    if (arg.alias) {
      parts.push(`-${arg.alias}`);
    }
  }
  return parts.join('  ');
}

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
      const argsSummary = buildArgsSummary(cmd);
      if (argsSummary) {
        lines.push(`    ${' '.repeat(28)} ${chalk.dim(argsSummary)}`);
      }
    }
    lines.push('');
  }

  lines.push(chalk.yellow('  Daemon 管理:'));
  lines.push(`    ${chalk.cyan('daemon status'.padEnd(28))} ${chalk.dim('查看 daemon 状态')}`);
  lines.push(`    ${chalk.cyan('daemon stop'.padEnd(28))} ${chalk.dim('停止 daemon 进程')}`);
  lines.push('');

  lines.push(chalk.yellow('  内置命令:'));
  lines.push(`    ${chalk.cyan('help [command]'.padEnd(28))} ${chalk.dim('显示帮助信息')}`);
  lines.push(`    ${chalk.cyan('exit / quit'.padEnd(28))} ${chalk.dim('退出 CLI')}`);
  lines.push(`    ${chalk.cyan('clear'.padEnd(28))} ${chalk.dim('清屏')}`);
  lines.push(`    ${chalk.cyan('history'.padEnd(28))} ${chalk.dim('显示命令历史')}`);
  lines.push('');
  lines.push(chalk.dim('  示例: wx-devtools-cli connect /path/to/project'));
  lines.push(chalk.dim('  示例: wx-devtools-cli get_page_snapshot'));
  lines.push(chalk.dim('  示例: wx-devtools-cli click button.submit'));
  lines.push(chalk.dim('  示例: wx-devtools-cli ide open --project /path'));
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
  const requiredArgs = cmd.args.filter(a => a.required);

  // 如果只有一个必填参数，使用位置参数形式
  if (requiredArgs.length === 1) {
    const arg = requiredArgs[0];
    switch (arg.type) {
      case 'string': return `${cmd.name} "value"`;
      case 'number': return `${cmd.name} 123`;
      default: return `${cmd.name} --${arg.name} "value"`;
    }
  }

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

// ==================== 命令解析公共逻辑 ====================

interface ResolvedCommand {
  cmd: CommandDef;
  args: Record<string, any>;
}

/**
 * 解析输入 → 匹配注册命令（含命名空间）→ 位置参数映射 → 类型转换
 * 返回 null 表示未找到命令（已输出错误信息）
 */
function resolveCommand(input: string, options?: { silent?: boolean }): ResolvedCommand | null {
  const { command, args } = parseCommand(input);
  if (!command) return null;

  // 1. 查找命令（支持 "ide open" 等命名空间形式）
  let cmd = registry.get(command);
  let finalArgs = { ...args };

  if (!cmd && args._positional?.length) {
    const nsCommand = `${command} ${args._positional[0]}`;
    cmd = registry.get(nsCommand);
    if (cmd) {
      // 消费第一个位置参数作为子命令
      finalArgs._positional = args._positional.slice(1);
      if (finalArgs._positional.length === 0) delete finalArgs._positional;
    }
  }

  if (!cmd) {
    if (!options?.silent) {
      console.log(out.error(`未知命令: ${command}`));
      console.log(out.dim('  输入 help 查看所有可用命令'));
    }
    return null;
  }

  // 2. 位置参数自动映射（仅单必填参数命令）
  if (finalArgs._positional?.length) {
    const requiredArgs = cmd.args.filter(a => a.required);
    if (requiredArgs.length === 1 && finalArgs[requiredArgs[0].name] === undefined) {
      finalArgs[requiredArgs[0].name] = finalArgs._positional[0];
    }
  }

  // 3. 清理 _positional，做类型转换
  delete finalArgs._positional;
  const coerced = coerceArgs(finalArgs, cmd.args);

  return { cmd, args: coerced };
}

// ==================== Daemon 模式命令执行 ====================

/**
 * 通过 daemon 执行命令
 */
async function executeDaemonCommand(input: string): Promise<void> {
  let resolved: ResolvedCommand | null;
  try {
    resolved = resolveCommand(input);
  } catch (e: any) {
    console.log(out.error(e.message));
    return;
  }
  if (!resolved) return;

  try {
    const resp = await sendCommand(resolved.cmd.name, resolved.args);
    if (resp.ok) {
      if (resp.output) console.log(resp.output);
    } else {
      console.log(out.error(resp.error || '命令执行失败'));
    }
  } catch (e: any) {
    console.log(out.error(e.message));
  }
}

// ==================== 本地命令执行（不需要 daemon）====================

async function executeLocalCommand(input: string): Promise<void> {
  let resolved: ResolvedCommand | null;
  try {
    resolved = resolveCommand(input);
  } catch (e: any) {
    console.log(out.error(e.message));
    return;
  }
  if (!resolved) return;

  try {
    const result = await resolved.cmd.handler(resolved.args, ctx);
    if (result) console.log(result);
  } catch (e: any) {
    console.log(out.error(e.message));
  }
}

// ==================== REPL 模式（向后兼容）====================

const commandHistory: string[] = [];

function getPrompt(): string {
  const connected = ctx.miniProgram ? chalk.green('●') : chalk.red('○');
  const page = ctx.currentPage?.path ? chalk.dim(` ${ctx.currentPage.path}`) : '';
  return `${connected}${page} ${chalk.bold('wx>')} `;
}

async function executeReplCommand(input: string): Promise<void> {
  const { command, args } = parseCommand(input);

  if (!command) return;

  // 记录历史
  commandHistory.push(input);

  // 内置命令
  switch (command) {
    case 'help': {
      const helpTarget = args._positional?.join(' ');
      console.log(showHelp(helpTarget));
      return;
    }

    case 'exit':
    case 'quit':
      await autoDisconnect();
      console.log(chalk.dim('再见! 👋'));
      process.exit(0);

    case 'clear':
      console.clear();
      return;

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

  // 查找注册的命令，解析参数
  let resolved: ResolvedCommand | null;
  try {
    resolved = resolveCommand(input);
  } catch (e: any) {
    console.log(out.error(e.message));
    return;
  }
  if (!resolved) return;

  try {
    const result = await resolved.cmd.handler(resolved.args, ctx);
    if (result) console.log(result);
  } catch (e: any) {
    console.log(out.error(e.message));
  }
}

async function autoConnect(): Promise<void> {
  if (ctx.miniProgram) return;
  const project = ctx.defaultProject;
  if (!project) return;

  console.log(out.dim(`  自动连接: ${project}...`));
  const connectCmd = registry.get('connect');
  if (!connectCmd) return;

  try {
    const result = await connectCmd.handler({ project }, ctx);
    console.log(result);
  } catch (e: any) {
    console.log(out.warn(`自动连接失败: ${e.message}`));
    console.log(out.dim('  可手动执行 connect --project /path'));
  }
  console.log('');
}

async function autoDisconnect(): Promise<void> {
  if (!ctx.miniProgram) return;
  console.log(out.dim('  断开连接...'));
  try {
    await ctx.miniProgram.disconnect();
  } catch {}
  ctx.reset();
}

function showBanner(): void {
  console.log('');
  console.log(chalk.bold('  🔧 wx-devtools-cli v0.1.0'));
  console.log(chalk.dim('  微信开发者工具交互式 CLI 控制器'));
  console.log(chalk.dim(`  ${allCommands.length} 个命令可用，输入 help 查看帮助`));
  console.log('');
}

function startRepl(): void {
  showBanner();
  autoConnect().then(() => {
    startPrompt();
  });
}

function startPrompt(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
    completer: (line: string) => {
      const trimmed = line.trim();
      const allNames = [
        ...registry.getAll().map(c => c.name),
        'help', 'exit', 'quit', 'clear', 'history',
        'daemon status', 'daemon stop',
      ];

      const uniquePrefixes = [...new Set(allNames.map(n => n.split(' ')[0]))];

      if (!trimmed.includes(' ')) {
        const hits = uniquePrefixes.filter(n => n.startsWith(trimmed));
        return [hits.length ? hits : uniquePrefixes, trimmed];
      }

      const parts = trimmed.split(/\s+/);
      const firstWord = parts[0];
      const lastPart = parts[parts.length - 1];

      if (parts.length === 2 && !lastPart.startsWith('-')) {
        const subCommands = allNames
          .filter(n => n.startsWith(firstWord + ' '))
          .map(n => n.slice(firstWord.length + 1));
        const hits = subCommands.filter(s => s.startsWith(lastPart));
        if (hits.length > 0) {
          return [hits, lastPart];
        }
      }

      let cmd = registry.get(firstWord);
      if (!cmd && parts.length >= 2) {
        cmd = registry.get(`${firstWord} ${parts[1]}`);
      }

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
        await executeReplCommand(trimmed);
      }
      prompt();
    });
  };

  rl.on('SIGINT', () => {
    console.log('');
    console.log(chalk.dim('按 Ctrl+C 再次退出，或输入 exit'));
    prompt();
  });

  rl.on('close', async () => {
    await autoDisconnect();
    console.log(chalk.dim('\n再见! 👋'));
    process.exit(0);
  });

  prompt();
}

// ==================== daemon 管理子命令 ====================

async function handleDaemonSubcommand(subcommand: string): Promise<void> {
  switch (subcommand) {
    case 'status': {
      const running = await isDaemonRunning();
      if (running) {
        const pid = getDaemonPid();
        console.log(out.success(`daemon 运行中 (PID: ${pid})`));
        try {
          const resp = await sendCommand('__status');
          if (resp.ok && resp.output) {
            const status = JSON.parse(resp.output);
            console.log(`  连接状态: ${status.connected ? '已连接' : '未连接'}`);
            if (status.currentPage) console.log(`  当前页面: ${status.currentPage}`);
            console.log(`  元素映射: ${status.elementMapSize} 个`);
            console.log(`  Console: ${status.consoleMessages} 条`);
            console.log(`  Network: ${status.networkRequests} 条`);
            console.log(`  运行时间: ${status.uptime}s`);
          }
        } catch {}
      } else {
        console.log(out.warn('daemon 未运行'));
        console.log(out.dim('  使用 wx-devtools-cli connect <project> 启动'));
      }
      break;
    }

    case 'stop': {
      const running = await isDaemonRunning();
      if (!running) {
        console.log(out.warn('daemon 未运行'));
        return;
      }
      console.log(out.dim('  正在停止 daemon...'));
      await stopDaemon();
      console.log(out.success('daemon 已停止'));
      break;
    }

    default:
      console.log(out.error(`未知 daemon 子命令: ${subcommand}`));
      console.log(out.dim('  可用: daemon status, daemon stop'));
  }
}

// ==================== 入口 ====================

const argv = process.argv.slice(2);

if (argv[0] === 'connect' && argv.length >= 2) {
  // ======= wx-devtools-cli connect <project_path> [options...] =======
  // 启动 daemon（如果没运行），然后发送 connect 命令
  const projectPath = argv[1];
  const restArgs = argv.slice(2);

  // 解析额外参数
  const extraArgs: Record<string, any> = {};
  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = restArgs[i + 1];
      if (next && !next.startsWith('--')) {
        extraArgs[key] = next;
        i++;
      } else {
        extraArgs[key] = true;
      }
    }
  }

  (async () => {
    try {
      // 启动 daemon
      const running = await isDaemonRunning();
      if (!running) {
        console.log(out.dim('  启动 daemon...'));
        const pid = await startDaemon();
        console.log(out.success(`daemon 已启动 (PID: ${pid})`));
      } else {
        const pid = getDaemonPid();
        console.log(out.dim(`  daemon 已在运行 (PID: ${pid})`));
      }

      // 发送连接命令
      const connectArgs = { project: projectPath, ...extraArgs };
      const resp = await sendCommand('connect', connectArgs);
      if (resp.ok) {
        if (resp.output) console.log(resp.output);
      } else {
        console.log(out.error(resp.error || '连接失败'));
        process.exit(1);
      }
    } catch (e: any) {
      console.error(out.error(e.message));
      process.exit(1);
    }
  })();

} else if (argv[0] === 'disconnect') {
  // ======= wx-devtools-cli disconnect =======
  (async () => {
    const running = await isDaemonRunning();
    if (!running) {
      console.log(out.warn('daemon 未运行'));
      process.exit(0);
    }
    const resp = await sendCommand('disconnect', {});
    if (resp.ok) {
      if (resp.output) console.log(resp.output);
    } else {
      console.log(out.error(resp.error || '断开失败'));
    }
  })();

} else if (argv[0] === 'daemon' && argv.length >= 2) {
  // ======= wx-devtools-cli daemon <status|stop> =======
  handleDaemonSubcommand(argv[1]);

} else if (argv[0] === '--repl') {
  // ======= wx-devtools-cli --repl =======
  // REPL 交互模式
  startRepl();

} else if (argv.length === 0) {
  // ======= wx-devtools-cli =======
  // 无参数：打印帮助信息
  console.log(showHelp());
  process.exit(0);

} else {
  // ======= wx-devtools-cli <command> [args] =======
  // 判断是本地命令还是需要 daemon
  const input = argv.join(' ');
  const { command, args } = parseCommand(input);

  if (!command) {
    process.exit(0);
  }

  // 内置命令
  if (command === 'help') {
    const helpTarget = args._positional?.join(' ');
    console.log(showHelp(helpTarget));
    process.exit(0);
  }

  // 本地命令
  if (isLocalCommand(command, args._positional)) {
    executeLocalCommand(input).then(() => {
      process.exit(0);
    }).catch((e) => {
      console.error(out.error(e.message));
      process.exit(1);
    });
  } else {
    // 需要 daemon
    (async () => {
      const running = await isDaemonRunning();
      if (!running) {
        console.log(out.error('daemon 未运行，请先执行 wx-devtools-cli connect <project_path>'));
        process.exit(1);
      }

      await executeDaemonCommand(input);
      process.exit(0);
    })();
  }
}

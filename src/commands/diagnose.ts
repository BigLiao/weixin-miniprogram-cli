/**
 * 诊断工具命令组 (4个)
 * diagnose, check-env, debug-elements, debug-connect
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// @ts-ignore
import automator from 'miniprogram-automator';

export const diagnoseConnection: CommandDef = defineCommand({
  name: 'diagnose',
  description: '诊断连接问题，检查配置和环境',
  category: '诊断工具',
  args: [
    { name: 'project', type: 'string', required: true, description: '小程序项目路径', alias: 'p' },
    { name: 'verbose', type: 'boolean', default: false, description: '显示详细诊断信息', alias: 'v' },
  ],
  handler: async (args, ctx) => {
    const lines: string[] = [out.info('连接诊断')];
    const projectPath = args.project;

    // 1. 检查项目路径
    if (fs.existsSync(projectPath)) {
      lines.push(out.success(`项目路径存在: ${projectPath}`));

      // 检查 project.config.json
      const configPath = path.join(projectPath, 'project.config.json');
      if (fs.existsSync(configPath)) {
        lines.push(out.success('project.config.json 存在'));
        if (args.verbose) {
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            lines.push(out.dim(`  appid: ${config.appid || 'N/A'}`));
            lines.push(out.dim(`  projectname: ${config.projectname || 'N/A'}`));
          } catch {}
        }
      } else {
        lines.push(out.error('project.config.json 不存在'));
      }
    } else {
      lines.push(out.error(`项目路径不存在: ${projectPath}`));
    }

    // 2. 检查当前连接
    lines.push('');
    if (ctx.miniProgram) {
      lines.push(out.success('当前已连接'));
      try {
        const page = await ctx.miniProgram.currentPage();
        lines.push(`  页面: ${page?.path || 'unknown'}`);
      } catch (e: any) {
        lines.push(out.warn(`连接可能不稳定: ${e.message}`));
      }
    } else {
      lines.push(out.dim('当前未连接'));
    }

    // 3. 检查微信开发者工具 CLI
    lines.push('');
    const cliPaths = [
      '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      '/Applications/微信开发者工具.app/Contents/MacOS/cli',
    ];
    let cliFound = false;
    for (const cli of cliPaths) {
      if (fs.existsSync(cli)) {
        lines.push(out.success(`CLI 找到: ${cli}`));
        cliFound = true;
        break;
      }
    }
    if (!cliFound) {
      lines.push(out.warn('未在默认路径找到微信开发者工具 CLI'));
      lines.push(out.dim('  请确保微信开发者工具已安装'));
    }

    return lines.join('\n');
  },
});

export const checkEnvironment: CommandDef = defineCommand({
  name: 'check-env',
  description: '检查运行环境（Node.js、微信开发者工具等）',
  category: '诊断工具',
  args: [],
  handler: async (_args, _ctx) => {
    const lines: string[] = [out.info('环境检查')];

    // Node.js 版本
    lines.push(`  Node.js: ${process.version}`);
    const major = parseInt(process.version.slice(1));
    if (major >= 16) {
      lines.push(out.success('Node.js 版本满足要求 (>=16)'));
    } else {
      lines.push(out.error('Node.js 版本过低，需要 >=16'));
    }

    // 操作系统
    lines.push(`  OS: ${process.platform} ${process.arch}`);

    // miniprogram-automator 版本
    try {
      const pkgPath = require.resolve('miniprogram-automator/package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      lines.push(`  miniprogram-automator: v${pkg.version}`);
    } catch {
      lines.push(out.dim('  miniprogram-automator: 已安装'));
    }

    // 微信开发者工具
    const platform = process.platform;
    let devtoolsFound = false;

    if (platform === 'darwin') {
      const paths = [
        '/Applications/wechatwebdevtools.app',
        '/Applications/微信开发者工具.app',
      ];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          lines.push(out.success(`微信开发者工具: ${p}`));
          devtoolsFound = true;
          break;
        }
      }
    } else if (platform === 'win32') {
      lines.push(out.dim('  Windows: 请确认开发者工具已安装并开启服务端口'));
      devtoolsFound = true; // 不确定，跳过检查
    }

    if (!devtoolsFound) {
      lines.push(out.warn('未检测到微信开发者工具'));
    }

    // 检查端口监听（尝试检测自动化端口）
    try {
      const result = execSync('lsof -i :9420 2>/dev/null || true', { encoding: 'utf-8' });
      if (result.trim()) {
        lines.push(out.success('端口 9420 已有服务监听（可能是开发者工具）'));
      } else {
        lines.push(out.dim('  端口 9420 未被监听'));
      }
    } catch {}

    return lines.join('\n');
  },
});

export const debugPageElements: CommandDef = defineCommand({
  name: 'debug-elements',
  description: '调试页面元素获取问题',
  category: '诊断工具',
  args: [
    { name: 'testAllStrategies', type: 'boolean', default: true, description: '测试所有选择器策略' },
    { name: 'customSelector', type: 'string', description: '自定义选择器测试' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();

    const lines: string[] = [out.info('页面元素调试')];

    // 测试基础选择器
    const selectors = ['page', 'view', 'text', 'button', 'input', 'image'];
    if (args.customSelector) {
      selectors.push(args.customSelector);
    }

    for (const sel of selectors) {
      try {
        const elements = await ctx.currentPage!.$$(sel);
        const count = elements ? elements.length : 0;
        if (count > 0) {
          lines.push(out.success(`${sel}: ${count} 个元素`));

          // 显示第一个元素信息
          if (args.testAllStrategies && count > 0) {
            try {
              const first = elements[0];
              const text = await first.text();
              if (text) {
                lines.push(out.dim(`    第一个: "${out.truncate(text, 40)}"`));
              }
            } catch {}
          }
        } else {
          lines.push(out.dim(`  ${sel}: 0 个元素`));
        }
      } catch (e: any) {
        lines.push(out.error(`${sel}: 查询失败 - ${e.message}`));
      }
    }

    // 页面路径
    lines.push('');
    lines.push(`  当前页面: ${ctx.currentPage!.path}`);

    return lines.join('\n');
  },
});

export const debugConnectionFlow: CommandDef = defineCommand({
  name: 'debug-connect',
  description: '调试连接流程（逐步追踪、计时、状态快照）',
  category: '诊断工具',
  args: [
    { name: 'project', type: 'string', required: true, description: '小程序项目绝对路径', alias: 'p' },
    { name: 'mode', type: 'string', default: 'auto', description: '连接模式: auto|launch|connect' },
    { name: 'dryRun', type: 'boolean', default: false, description: '仅模拟，不实际连接' },
    { name: 'captureSnapshot', type: 'boolean', default: true, description: '捕获每步状态快照' },
    { name: 'verbose', type: 'boolean', default: true, description: '显示详细调试信息', alias: 'v' },
  ],
  handler: async (args, ctx) => {
    const lines: string[] = [out.bold('=== 连接流程调试 ==='), ''];
    const startTime = Date.now();

    const step = (num: number, name: string) => {
      lines.push(out.highlight(`[步骤 ${num}] ${name}`));
    };

    // Step 1: 检查项目
    step(1, '检查项目路径');
    const projectPath = args.project;
    if (fs.existsSync(projectPath)) {
      lines.push(out.success(`  路径有效: ${projectPath}`));
      const configExists = fs.existsSync(path.join(projectPath, 'project.config.json'));
      lines.push(configExists
        ? out.success('  project.config.json 存在')
        : out.error('  project.config.json 不存在'));
    } else {
      lines.push(out.error(`  路径不存在: ${projectPath}`));
      return lines.join('\n');
    }
    lines.push(`  耗时: ${Date.now() - startTime}ms`);
    lines.push('');

    // Step 2: 检查 CLI
    step(2, '检查微信开发者工具 CLI');
    const cliPaths = [
      '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      '/Applications/微信开发者工具.app/Contents/MacOS/cli',
    ];
    let foundCli: string | null = null;
    for (const cli of cliPaths) {
      if (fs.existsSync(cli)) {
        foundCli = cli;
        break;
      }
    }
    if (foundCli) {
      lines.push(out.success(`  CLI: ${foundCli}`));
    } else {
      lines.push(out.warn('  未找到 CLI'));
    }
    lines.push(`  耗时: ${Date.now() - startTime}ms`);
    lines.push('');

    // Step 3: 检查端口
    step(3, '检查自动化端口');
    try {
      const result = execSync('lsof -i :9420 2>/dev/null || true', { encoding: 'utf-8' });
      if (result.trim()) {
        lines.push(out.success('  端口 9420 已被监听'));
      } else {
        lines.push(out.dim('  端口 9420 未被监听'));
      }
    } catch {
      lines.push(out.dim('  端口检查跳过'));
    }
    lines.push(`  耗时: ${Date.now() - startTime}ms`);
    lines.push('');

    if (args.dryRun) {
      // Step 4: 模拟连接
      step(4, '模拟连接 (dry-run)');
      lines.push(out.info(`  模式: ${args.mode}`));
      lines.push(out.info('  跳过实际连接'));
      lines.push(`  总耗时: ${Date.now() - startTime}ms`);
      return lines.join('\n');
    }

    // Step 4: 尝试连接
    step(4, '尝试连接');
    try {
      const connectStart = Date.now();
      const mp = await automator.launch({ projectPath: args.project });
      lines.push(out.success(`  连接成功 (${Date.now() - connectStart}ms)`));
      lines.push('');

      // Step 5: 获取页面
      step(5, '获取当前页面');
      const page = await mp.currentPage();
      lines.push(out.success(`  页面: ${page?.path || 'unknown'}`));

      ctx.miniProgram = mp;
      ctx.currentPage = page;
      ctx.lastConnectionParams = args;
      lines.push('');

      // Step 6: 快照
      if (args.captureSnapshot) {
        step(6, '捕获状态快照');
        try {
          const elements = await page!.$$('view');
          lines.push(`  页面元素(view): ${elements?.length || 0} 个`);
        } catch {}
      }
    } catch (e: any) {
      lines.push(out.error(`  连接失败: ${e.message}`));
      if (args.verbose && e.stack) {
        lines.push(out.dim(e.stack));
      }
    }

    lines.push('');
    lines.push(out.bold(`总耗时: ${Date.now() - startTime}ms`));

    return lines.join('\n');
  },
});

export const diagnoseCommands: CommandDef[] = [
  diagnoseConnection,
  checkEnvironment,
  debugPageElements,
  debugConnectionFlow,
];

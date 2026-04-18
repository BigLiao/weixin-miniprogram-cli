import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendArtifact } from './artifacts.js';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

export interface E2EConfig {
  projectPath: string;
  autoPort: number;
}

export interface RunCliOptions {
  allowFailure?: boolean;
  artifactDir?: string;
  label?: string;
}

export interface RunCliResult {
  command: string[];
  stdout: string;
  stderr: string;
  combinedOutput: string;
  exitCode: number;
  durationMs: number;
}

export interface RunCommandOptions {
  cwd?: string;
  allowFailure?: boolean;
  artifactDir?: string;
  label?: string;
}

export function isE2EEnabled(): boolean {
  return process.env.WX_E2E === '1';
}

export function getE2EConfig(): E2EConfig {
  const projectPath = resolve(process.env.WX_E2E_PROJECT || resolve(repoRoot, 'examples/miniprogram-demo'));
  const autoPort = Number(process.env.WX_E2E_AUTO_PORT || '9420');

  if (!existsSync(projectPath)) {
    throw new Error(`E2E 项目不存在: ${projectPath}`);
  }
  if (!Number.isFinite(autoPort) || autoPort <= 0) {
    throw new Error(`无效的 WX_E2E_AUTO_PORT: ${process.env.WX_E2E_AUTO_PORT || ''}`);
  }

  return { projectPath, autoPort };
}

export function runCli(args: string[], options: RunCliOptions = {}): RunCliResult {
  const command = [resolve(repoRoot, 'build/cli.js'), ...args];
  return runNodeCommand(command, options);
}

function runNodeCommand(command: string[], options: RunCommandOptions = {}): RunCliResult {
  const start = Date.now();
  const result = spawnSync(process.execPath, command, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf-8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
  });
  const durationMs = Date.now() - start;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const combinedOutput = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
  const exitCode = result.status ?? (result.error ? 1 : 0);

  if (options.artifactDir) {
    const label = options.label || command[1] || 'command';
    appendArtifact(
      options.artifactDir,
      'commands.log',
      [
        `$ node ${command.join(' ')}`,
        `exitCode=${exitCode} durationMs=${durationMs}`,
        stdout ? `stdout:\n${stdout.trimEnd()}` : 'stdout:',
        stderr ? `stderr:\n${stderr.trimEnd()}` : 'stderr:',
        '',
      ].join('\n'),
    );
  }

  if (!options.allowFailure && exitCode !== 0) {
    throw new Error(
      [
        `命令执行失败: node ${command.join(' ')}`,
        `exitCode=${exitCode}`,
        combinedOutput || '(no output)',
      ].join('\n'),
    );
  }

  return {
    command,
    stdout,
    stderr,
    combinedOutput,
    exitCode,
    durationMs,
  };
}

export function runCommand(
  binary: string,
  args: string[],
  options: RunCommandOptions = {},
): RunCliResult {
  const command = [binary, ...args];
  const start = Date.now();
  const result = spawnSync(binary, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf-8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
  });
  const durationMs = Date.now() - start;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const combinedOutput = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
  const exitCode = result.status ?? (result.error ? 1 : 0);

  if (options.artifactDir) {
    const label = options.label || binary;
    appendArtifact(
      options.artifactDir,
      'commands.log',
      [
        `$ ${command.join(' ')}`,
        `exitCode=${exitCode} durationMs=${durationMs}`,
        stdout ? `stdout:\n${stdout.trimEnd()}` : 'stdout:',
        stderr ? `stderr:\n${stderr.trimEnd()}` : 'stderr:',
        '',
      ].join('\n'),
    );
  }

  if (!options.allowFailure && exitCode !== 0) {
    throw new Error(
      [
        `命令执行失败: ${command.join(' ')}`,
        `exitCode=${exitCode}`,
        combinedOutput || '(no output)',
      ].join('\n'),
    );
  }

  return {
    command,
    stdout,
    stderr,
    combinedOutput,
    exitCode,
    durationMs,
  };
}

export function prepareE2EProject(config: E2EConfig, artifactDir: string): void {
  const npmPackageDir = join(config.projectPath, 'node_modules', 'tdesign-miniprogram');
  if (!existsSync(npmPackageDir)) {
    const installResult = runCommand('npm', ['install'], {
      cwd: config.projectPath,
      artifactDir,
      label: 'npm-install-demo',
    });
    if (!installResult.combinedOutput.includes('added') && !existsSync(npmPackageDir)) {
      throw new Error(`demo 依赖安装后仍缺少 tdesign-miniprogram: ${npmPackageDir}`);
    }
  }

  const buildResult = runCli(['build-npm', '--project', config.projectPath], {
    artifactDir,
    label: 'build-npm-demo',
  });
  if (!buildResult.combinedOutput.includes('NPM 构建完成')) {
    throw new Error(`build-npm 未成功完成:\n${buildResult.combinedOutput}`);
  }
  if (buildResult.combinedOutput.includes('[error]')) {
    throw new Error(`build-npm 返回了错误输出:\n${buildResult.combinedOutput}`);
  }
}

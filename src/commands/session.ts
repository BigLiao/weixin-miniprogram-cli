/**
 * Session 管理命令组
 * session list, session use
 *
 * 采用工厂模式：静态占位 defs 用于 help 显示，daemon 启动时用工厂创建真实实现覆盖。
 */

import { defineCommand, type CommandDef, type ArgDef } from '../registry.js';
import type { SessionManager } from '../session-manager.js';
import * as out from '../utils/output.js';

const listSessionsMeta = {
  name: 'session list',
  description: '列出所有 session（当前项目槽位）',
  category: 'Session 管理',
  args: [
    { name: 'probe', type: 'boolean', default: false, description: '探活：检测 connected session 是否仍然可用' },
  ] as ArgDef[],
};

const useSessionMeta = {
  name: 'session use',
  description: '切换默认活跃 session',
  category: 'Session 管理',
  args: [
    { name: 'id', type: 'string', required: true, description: '目标 session ID' },
  ] as ArgDef[],
};

function buildListHandler(sessionMgr: SessionManager) {
  return async (args: Record<string, any>) => {
    const sessions = sessionMgr.getAll();

    if (sessions.length === 0) {
      return out.dim('没有活跃的 session。使用 open 或 launch 创建');
    }

    if (args.probe) {
      for (const s of sessions) {
        if (s.status === 'connected' && s.miniProgram) {
          try {
            s.currentPage = await s.miniProgram.currentPage();
          } catch {
            s.markError();
          }
        }
      }
    }

    const lines: string[] = [];
    lines.push(out.info(`共 ${sessions.length} 个 session:`));
    lines.push('');

    for (const s of sessions) {
      const isActive = s.id === sessionMgr.activeId;
      const statusIcon =
        s.status === 'connected' ? '●' :
        s.status === 'error' ? '✖' : '○';
      const activeMarker = isActive ? ' ★' : '';
      const idleS = Math.floor((Date.now() - s.lastActiveAt) / 1000);
      const idleStr = idleS < 60 ? `${idleS}s` : `${Math.floor(idleS / 60)}m${idleS % 60}s`;
      const project = s.projectPath || '-';
      const httpPort = s.ideHttpPort ?? '-';
      const automatorPort = s.automatorPort ?? '-';
      const page = s.currentPage?.path || '-';

      lines.push(`  ${statusIcon} ${s.id}${activeMarker}  ${s.status}`);
      lines.push(`    project=${project}`);
      lines.push(`    http=${httpPort}  automator=${automatorPort}  page=${page}  idle=${idleStr}`);
    }

    return lines.join('\n');
  };
}

function buildUseHandler(sessionMgr: SessionManager) {
  return async (args: Record<string, any>) => {
    const id = args.id;
    sessionMgr.setActive(id);
    return out.success(`已切换到 session "${id}"`);
  };
}

/**
 * 创建绑定了 sessionMgr 的真实命令实现
 */
export function createSessionCommands(sessionMgr: SessionManager): CommandDef[] {
  const listHandler = buildListHandler(sessionMgr);
  const useHandler = buildUseHandler(sessionMgr);

  return [
    defineCommand({ ...listSessionsMeta, handler: listHandler }),
    defineCommand({ ...useSessionMeta, handler: useHandler }),
    defineCommand({
      name: 'sessions',
      description: '列出所有 session（兼容旧命令）',
      category: 'Session 管理',
      args: listSessionsMeta.args,
      handler: listHandler,
    }),
    defineCommand({
      name: 'switch-session',
      description: '切换默认活跃 session（兼容旧命令）',
      category: 'Session 管理',
      args: useSessionMeta.args,
      handler: useHandler,
    }),
  ];
}

const placeholderHandler = async () => out.error('此命令仅在 daemon 模式下可用');

export const sessionCommandDefs: CommandDef[] = [
  defineCommand({ ...listSessionsMeta, handler: placeholderHandler }),
  defineCommand({ ...useSessionMeta, handler: placeholderHandler }),
  defineCommand({
    name: 'sessions',
    description: '列出所有 session（兼容旧命令）',
    category: 'Session 管理',
    args: listSessionsMeta.args,
    handler: placeholderHandler,
  }),
  defineCommand({
    name: 'switch-session',
    description: '切换默认活跃 session（兼容旧命令）',
    category: 'Session 管理',
    args: useSessionMeta.args,
    handler: placeholderHandler,
  }),
];

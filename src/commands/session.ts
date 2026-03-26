/**
 * Session 管理命令组 (2个)
 * sessions, switch-session
 *
 * 采用工厂模式：静态占位 defs 用于 help 显示，daemon 启动时用工厂创建真实实现覆盖。
 */

import { defineCommand, type CommandDef, type ArgDef } from '../registry.js';
import type { SessionManager } from '../session-manager.js';
import * as out from '../utils/output.js';

// ==================== 共享元数据（消除占位 / 工厂双份定义） ====================

const listSessionsMeta = {
  name: 'sessions',
  description: '列出所有 session（小程序连接）',
  category: 'Session 管理',
  args: [
    { name: 'probe', type: 'boolean', default: false, description: '探活：检测各 session 连接是否存活' },
    { name: 'clean', type: 'boolean', default: false, description: '清理所有 dead session' },
  ] as ArgDef[],
};

const switchSessionMeta = {
  name: 'switch-session',
  description: '切换默认活跃 session',
  category: 'Session 管理',
  args: [
    { name: 'id', type: 'string', required: true, description: '目标 session ID' },
  ] as ArgDef[],
};

// ==================== 工厂函数 ====================

/**
 * 创建绑定了 sessionMgr 的真实命令实现
 */
export function createSessionCommands(sessionMgr: SessionManager): CommandDef[] {
  const listSessions: CommandDef = defineCommand({
    ...listSessionsMeta,
    handler: async (args) => {
      const sessions = sessionMgr.getAll();

      // --clean: 清理 dead session
      if (args.clean) {
        const deadIds: string[] = [];
        for (const s of sessions) {
          if (s.status === 'dead') {
            deadIds.push(s.id);
          }
        }
        for (const id of deadIds) {
          sessionMgr.remove(id);
        }
        if (deadIds.length > 0) {
          return out.success(`已清理 ${deadIds.length} 个 dead session: ${deadIds.join(', ')}`);
        }
        return out.dim('没有需要清理的 dead session');
      }

      if (sessions.length === 0) {
        return out.dim('没有活跃的 session。使用 open 创建连接');
      }

      // --probe: 对 connected session 探活
      if (args.probe) {
        for (const s of sessions) {
          if (s.status === 'connected' && s.miniProgram) {
            try {
              await s.miniProgram.currentPage();
            } catch {
              s.markDead();
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
          s.status === 'dead' ? '✖' : '○';
        const activeMarker = isActive ? ' ★' : '';
        const page = s.currentPage?.path || '-';
        const idleS = Math.floor((Date.now() - s.lastActiveAt) / 1000);
        const idleStr = idleS < 60 ? `${idleS}s` : `${Math.floor(idleS / 60)}m${idleS % 60}s`;

        lines.push(`  ${statusIcon} ${s.id}${activeMarker}  ${s.status}  page=${page}  idle=${idleStr}`);
      }

      return lines.join('\n');
    },
  });

  const switchSession: CommandDef = defineCommand({
    ...switchSessionMeta,
    handler: async (args) => {
      const id = args.id;
      sessionMgr.setActive(id);
      return out.success(`已切换到 session "${id}"`);
    },
  });

  return [listSessions, switchSession];
}

// ==================== 静态占位 ====================

/**
 * 占位命令定义（用于 allCommands 注册，help 显示用）
 * daemon 启动时会用工厂创建的真实实现覆盖
 */
const placeholderHandler = async () => out.error('此命令仅在 daemon 模式下可用');

export const sessionCommandDefs: CommandDef[] = [
  defineCommand({ ...listSessionsMeta, handler: placeholderHandler }),
  defineCommand({ ...switchSessionMeta, handler: placeholderHandler }),
];

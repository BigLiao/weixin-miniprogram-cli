/**
 * SessionManager — 管理多个 Session 的生命周期
 *
 * 类 ADB 模型：一个 daemon 管理多个 session，每个 session 对应一个小程序连接。
 */

import { Session } from './context.js';
import { logger } from './utils/logger.js';

export class SessionManager {
  /** 所有活跃 session */
  readonly sessions: Map<string, Session> = new Map();

  /** 当前默认 session ID */
  activeId: string | null = null;

  /** 自增 ID 计数器 */
  private nextId: number = 1;

  /**
   * 创建新 session
   * @param id 可选自定义 ID，否则自动生成 s1/s2/...
   */
  create(id?: string): Session {
    const sessionId = id || this.generateId();
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session "${sessionId}" 已存在`);
    }
    const session = new Session(sessionId);
    this.sessions.set(sessionId, session);
    logger.info(`Session 创建: ${sessionId}`);
    return session;
  }

  /** 获取指定 session */
  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /** 获取所有 session */
  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  /** 移除 session（不断开连接，调用方负责先断开） */
  remove(id: string): boolean {
    const removed = this.sessions.delete(id);
    if (removed && this.activeId === id) {
      // 如果移除的是活跃 session，自动切换
      const remaining = this.getAll();
      this.activeId = remaining.length === 1 ? remaining[0].id : null;
    }
    return removed;
  }

  /** 设置活跃 session */
  setActive(id: string): void {
    if (!this.sessions.has(id)) {
      throw new Error(`Session "${id}" 不存在`);
    }
    this.activeId = id;
  }

  /**
   * 解析 session：核心路由逻辑
   *
   * 1. explicit id → 用它
   * 2. activeId → 用它
   * 3. 仅一个 session → 自动选中
   * 4. 多个 → 报错提示
   */
  resolve(explicitId?: string): Session {
    // 1. 显式指定
    if (explicitId) {
      const s = this.sessions.get(explicitId);
      if (!s) {
        throw new Error(`Session "${explicitId}" 不存在。使用 sessions 查看所有 session`);
      }
      return s;
    }

    // 2. 有活跃 session
    if (this.activeId) {
      const s = this.sessions.get(this.activeId);
      if (s) return s;
      // activeId 指向的 session 已被移除，清空
      this.activeId = null;
    }

    // 3. 仅一个 session
    const all = this.getAll();
    if (all.length === 1) {
      return all[0];
    }

    // 4. 没有 session
    if (all.length === 0) {
      throw new Error('没有可用的 session。请先执行 open');
    }

    // 5. 多个 session，无法自动选择
    const ids = all.map(s => s.id).join(', ');
    throw new Error(
      `存在多个 session (${ids})，无法自动选择。` +
      '请使用 --session <id> 指定，或 switch-session --id <id> 切换默认 session'
    );
  }

  /**
   * 断开所有 session 的连接（用于 gracefulShutdown）
   */
  async disconnectAll(): Promise<void> {
    const promises = this.getAll().map(async (session) => {
      if (session.miniProgram) {
        try {
          await Promise.race([
            session.miniProgram.disconnect(),
            new Promise(r => setTimeout(r, 5000)),
          ]);
          logger.info(`Session ${session.id} 连接已断开`);
        } catch {
          // 忽略断开错误
        }
        session.reset();
      }
    });
    await Promise.all(promises);
    this.sessions.clear();
    this.activeId = null;
  }

  /** 生成自增 session ID */
  private generateId(): string {
    while (this.sessions.has(`s${this.nextId}`)) {
      this.nextId++;
    }
    return `s${this.nextId++}`;
  }
}

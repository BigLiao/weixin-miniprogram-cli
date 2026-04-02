/**
 * SharedContext - 所有命令共享的状态
 * 对应 MCP 项目的 ToolContext / MiniProgramContext
 */

export interface ConsoleMessage {
  msgid: number;
  type: string;
  args: any[];
  timestamp: number;
  stack?: string;
}

export interface NetworkRequest {
  reqid: string;
  type: 'request';
  method: string;
  url: string;
  statusCode?: number;
  requestData?: any;
  requestHeader?: Record<string, string>;
  responseData?: any;
  responseHeader?: Record<string, string>;
  timestamp: number;
  duration?: number;
  success: boolean;
  errMsg?: string;
}

/** 网络日志缓冲区最大条数（小程序端 & daemon 端共用） */
export const NETWORK_BUFFER_SIZE = 200;

export class SharedContext {
  miniProgram: any | null = null;
  currentPage: any | null = null;
  consoleMessages: ConsoleMessage[] = [];
  networkRequests: NetworkRequest[] = [];
  consoleListening: boolean = false;
  networkListening: boolean = false;
  lastConnectionParams: Record<string, any> | null = null;
  /** 小程序所有页面路径（来自 __wxConfig.pages） */
  appPages: string[] = [];
  /** 小程序 tabBar 配置（来自 __wxConfig.tabBar） */
  appTabBar: any | null = null;
  /** IDE CLI 路径（用户手动设置或自动检测） */
  cliPath: string | null = null;
  /** 默认项目路径（来自 connect 或 config 设置） */
  defaultProject: string | null = null;
  private consoleMsgId: number = 0;
  private networkReqId: number = 0;

  /** 检查是否已连接 */
  ensureConnected(): void {
    if (!this.miniProgram) {
      throw new Error('未连接到微信开发者工具。请先执行 connect');
    }
  }

  /** 检查是否有当前页面 */
  ensurePage(): void {
    this.ensureConnected();
    if (!this.currentPage) {
      throw new Error('没有活动页面。请先执行 get_current_page');
    }
  }

  /** 通过 CSS 选择器获取元素 */
  async getElementBySelector(selector: string): Promise<any> {
    this.ensurePage();
    const el = await this.currentPage!.$(selector);
    if (!el) {
      throw new Error(`未找到元素: "${selector}"。请检查选择器是否正确`);
    }
    return el;
  }

  /** 生成下一个 console 消息 ID */
  nextConsoleMsgId(): number {
    return ++this.consoleMsgId;
  }

  /** 生成下一个网络请求 ID */
  nextNetworkReqId(): string {
    return `req_${++this.networkReqId}`;
  }

  /** 添加 console 消息 */
  addConsoleMessage(type: string, args: any[], stack?: string): void {
    this.consoleMessages.push({
      msgid: this.nextConsoleMsgId(),
      type,
      args,
      timestamp: Date.now(),
      stack,
    });
  }

  /** 添加网络请求（环形缓冲区，超过上限丢弃最旧的） */
  addNetworkRequest(req: Omit<NetworkRequest, 'reqid'>): string {
    const reqid = this.nextNetworkReqId();
    this.networkRequests.push({ ...req, reqid });
    if (this.networkRequests.length > NETWORK_BUFFER_SIZE) {
      this.networkRequests.splice(0, this.networkRequests.length - NETWORK_BUFFER_SIZE);
    }
    return reqid;
  }

  /** 更新网络请求响应 */
  updateNetworkRequest(reqid: string, update: Partial<NetworkRequest>): void {
    const req = this.networkRequests.find(r => r.reqid === reqid);
    if (req) {
      Object.assign(req, update);
    }
  }

  /** 重置所有状态 */
  reset(): void {
    this.miniProgram = null;
    this.currentPage = null;
    this.consoleMessages = [];
    this.networkRequests = [];
    this.consoleListening = false;
    this.networkListening = false;
    this.appPages = [];
    this.appTabBar = null;
    this.consoleMsgId = 0;
    this.networkReqId = 0;
  }
}

// ==================== Session（多 session 架构）====================

export type SessionStatus = 'connected' | 'disconnected' | 'dead';

/**
 * Session 继承 SharedContext，对命令层完全透明。
 * 每个 Session 对应一个小程序连接实例。
 */
export class Session extends SharedContext {
  readonly id: string;
  status: SessionStatus = 'disconnected';
  readonly createdAt: number = Date.now();
  lastActiveAt: number = Date.now();

  constructor(id: string) {
    super();
    this.id = id;
  }

  /** 更新活跃时间 */
  touch(): void {
    this.lastActiveAt = Date.now();
  }

  /** 重置状态并标记为 disconnected */
  override reset(): void {
    super.reset();
    this.status = 'disconnected';
  }

  /** 标记为 dead（连接已不可恢复） */
  markDead(): void {
    this.status = 'dead';
    this.miniProgram = null;
    this.currentPage = null;
  }

  /** 返回 session 概要信息 */
  toSummary(): {
    id: string;
    status: SessionStatus;
    currentPage: string | null;
    idleMs: number;
    createdAt: number;
  } {
    return {
      id: this.id,
      status: this.status,
      currentPage: this.currentPage?.path || null,
      idleMs: Date.now() - this.lastActiveAt,
      createdAt: this.createdAt,
    };
  }
}

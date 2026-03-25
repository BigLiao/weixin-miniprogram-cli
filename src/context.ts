/**
 * SharedContext - 所有命令共享的状态
 * 对应 MCP 项目的 ToolContext / MiniProgramContext
 */

export interface ElementMapInfo {
  selector: string;
  index: number;
}

export interface ConsoleMessage {
  msgid: number;
  type: string;
  args: any[];
  timestamp: number;
  stack?: string;
}

export interface NetworkRequest {
  reqid: string;
  type: 'request' | 'uploadFile' | 'downloadFile';
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

export class SharedContext {
  miniProgram: any | null = null;
  currentPage: any | null = null;
  elementMap: Map<string, ElementMapInfo> = new Map();
  consoleMessages: ConsoleMessage[] = [];
  networkRequests: NetworkRequest[] = [];
  consoleListening: boolean = false;
  networkListening: boolean = false;
  lastConnectionParams: Record<string, any> | null = null;
  /** IDE CLI 路径（用户手动设置或自动检测） */
  cliPath: string | null = null;
  /** 默认项目路径（来自 connect_devtools 或 config 设置） */
  defaultProject: string | null = null;
  private consoleMsgId: number = 0;
  private networkReqId: number = 0;

  /** 检查是否已连接 */
  ensureConnected(): void {
    if (!this.miniProgram) {
      throw new Error('未连接到微信开发者工具。请先执行 connect_devtools');
    }
  }

  /** 检查是否有当前页面 */
  ensurePage(): void {
    this.ensureConnected();
    if (!this.currentPage) {
      throw new Error('没有活动页面。请先执行 get_current_page');
    }
  }

  /** 通过 UID 获取元素 */
  async getElementByUid(uid: string): Promise<any> {
    this.ensurePage();
    const info = this.elementMap.get(uid);
    if (!info) {
      throw new Error(`未找到 UID "${uid}"。请先执行 get_page_snapshot 获取页面快照`);
    }
    const elements = await this.currentPage!.$$(info.selector);
    if (!elements || elements.length <= info.index) {
      throw new Error(`元素 "${uid}" 已不存在于页面中。请重新执行 get_page_snapshot`);
    }
    return elements[info.index];
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

  /** 添加网络请求 */
  addNetworkRequest(req: Omit<NetworkRequest, 'reqid'>): string {
    const reqid = this.nextNetworkReqId();
    this.networkRequests.push({ ...req, reqid });
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
    this.elementMap.clear();
    this.consoleMessages = [];
    this.networkRequests = [];
    this.consoleListening = false;
    this.networkListening = false;
    this.consoleMsgId = 0;
    this.networkReqId = 0;
  }
}

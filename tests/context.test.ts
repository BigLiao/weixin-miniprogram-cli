import { describe, expect, it } from 'vitest';
import { NETWORK_BUFFER_SIZE, Session, SharedContext } from '../src/context.js';

describe('SharedContext', () => {
  it('assigns incremental ids to console messages', () => {
    const ctx = new SharedContext();

    ctx.addConsoleMessage('log', ['hello']);
    ctx.addConsoleMessage('error', ['boom']);

    expect(ctx.consoleMessages.map(msg => msg.msgid)).toEqual([1, 2]);
    expect(ctx.consoleMessages.map(msg => msg.type)).toEqual(['log', 'error']);
  });

  it('keeps network requests within the configured ring buffer size', () => {
    const ctx = new SharedContext();

    for (let i = 0; i < NETWORK_BUFFER_SIZE + 5; i++) {
      ctx.addNetworkRequest({
        type: 'request',
        method: 'GET',
        url: `https://example.com/${i}`,
        timestamp: i,
        success: true,
      });
    }

    expect(ctx.networkRequests).toHaveLength(NETWORK_BUFFER_SIZE);
    expect(ctx.networkRequests[0]?.url).toBe('https://example.com/5');
    expect(ctx.networkRequests.at(-1)?.reqid).toBe(`req_${NETWORK_BUFFER_SIZE + 5}`);
  });
});

describe('Session', () => {
  it('resets automation state when marked as opened and preserves project metadata', () => {
    const session = new Session('session-1');
    session.consoleListening = true;
    session.networkListening = true;
    session.currentPage = { path: 'pages/old/index' };
    session.projectPath = '/tmp/old-project';

    session.markOpened({
      projectPath: '/tmp/new-project',
      ideHttpPort: 4567,
      automatorPort: 9420,
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    });

    expect(session.status).toBe('opened');
    expect(session.currentPage).toBeNull();
    expect(session.consoleListening).toBe(false);
    expect(session.networkListening).toBe(false);
    expect(session.projectPath).toBe('/tmp/new-project');
    expect(session.ideHttpPort).toBe(4567);
    expect(session.automatorPort).toBe(9420);
  });
});

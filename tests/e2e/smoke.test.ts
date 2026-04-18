import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createArtifactDir, writeArtifact } from './helpers/artifacts.js';
import { getE2EConfig, isE2EEnabled, prepareE2EProject, runCli } from './helpers/cli.js';

const describeE2E = isE2EEnabled() ? describe : describe.skip;
const config = isE2EEnabled() ? getE2EConfig() : null;
const artifactDir = isE2EEnabled() ? createArtifactDir('smoke') : null;

describeE2E('wx-mp-cli e2e smoke', () => {
  beforeAll(() => {
    if (!config || !artifactDir) return;

    writeArtifact(
      artifactDir,
      'env.json',
      JSON.stringify(
        {
          projectPath: config.projectPath,
          autoPort: config.autoPort,
        },
        null,
        2,
      ),
    );

    prepareE2EProject(config, artifactDir);

    const openResult = runCli(['open', config.projectPath], {
      artifactDir,
      label: 'open',
    });
    expect(openResult.combinedOutput).toContain('项目已打开');

    const launchResult = runCli(['launch', '--auto-port', String(config.autoPort)], {
      artifactDir,
      label: 'launch',
    });
    expect(launchResult.combinedOutput).toContain('连接成功');
  });

  afterAll(() => {
    if (!artifactDir) return;

    runCli(['close'], {
      allowFailure: true,
      artifactDir,
      label: 'close',
    });
  });

  it('reports connected status and current home page', () => {
    expect(artifactDir).not.toBeNull();

    const statusResult = runCli(['status'], {
      artifactDir: artifactDir!,
      label: 'status',
    });

    expect(statusResult.combinedOutput).toContain('connected');
    expect(statusResult.combinedOutput).toContain('pages/home/index');
  });

  it('captures page data and screenshot artifacts', () => {
    expect(artifactDir).not.toBeNull();

    const snapshotPath = join(artifactDir!, 'snapshot.txt');
    const screenshotPath = join(artifactDir!, 'smoke.png');

    const pageResult = runCli(['page'], {
      artifactDir: artifactDir!,
      label: 'page',
    });
    expect(pageResult.combinedOutput).toContain('当前页面');

    const snapshotResult = runCli(['snapshot', '--filePath', snapshotPath], {
      artifactDir: artifactDir!,
      label: 'snapshot',
    });
    expect(snapshotResult.combinedOutput).toContain('页面快照获取成功');
    expect(existsSync(snapshotPath)).toBe(true);

    const screenshotResult = runCli(['screenshot', '--path', screenshotPath], {
      artifactDir: artifactDir!,
      label: 'screenshot',
    });
    expect(screenshotResult.combinedOutput).toContain('截图已保存');
    expect(existsSync(screenshotPath)).toBe(true);
  });

  it('navigates to the login page and asserts stable text', () => {
    expect(artifactDir).not.toBeNull();

    const gotoResult = runCli(['goto', 'pages/login/login'], {
      artifactDir: artifactDir!,
      label: 'goto-login',
    });
    expect(gotoResult.combinedOutput).toContain('导航到:');

    const pageResult = runCli(['page'], {
      artifactDir: artifactDir!,
      label: 'page-login',
    });
    expect(pageResult.combinedOutput).toContain('pages/login/login');

    const textResult = runCli(['assert-text', '.login__title', '--textContains', '欢迎登录'], {
      artifactDir: artifactDir!,
      label: 'assert-login-title',
    });
    expect(textResult.combinedOutput).toContain('文本包含');
  });
});

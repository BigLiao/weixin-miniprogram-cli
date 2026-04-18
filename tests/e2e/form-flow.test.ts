import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createArtifactDir, writeArtifact } from './helpers/artifacts.js';
import { getE2EConfig, isE2EEnabled, prepareE2EProject, runCli } from './helpers/cli.js';

const describeE2E = isE2EEnabled() ? describe : describe.skip;
const config = isE2EEnabled() ? getE2EConfig() : null;
const artifactDir = isE2EEnabled() ? createArtifactDir('form-flow') : null;

describeE2E('wx-mp-cli e2e form flow', () => {
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

  it('enables sms login submission and records the outbound request', () => {
    expect(artifactDir).not.toBeNull();

    const relaunchResult = runCli(['relaunch', 'pages/login/login'], {
      artifactDir: artifactDir!,
      label: 'relaunch-login',
    });
    expect(relaunchResult.combinedOutput).toContain('重启并导航到: pages/login/login');

    const clearNetworkResult = runCli(['network-clear'], {
      artifactDir: artifactDir!,
      label: 'network-clear',
    });
    expect(clearNetworkResult.combinedOutput).toContain('已清除');

    const phoneInputResult = runCli([
      'eval',
      '--code',
      "const p=getCurrentPages().at(-1); p.onPhoneInput({detail:{value:'13800138000'}}); return p.data;",
    ], {
      artifactDir: artifactDir!,
      label: 'set-phone',
    });
    expect(phoneInputResult.combinedOutput).toContain('"phoneNumber": "13800138000"');
    expect(phoneInputResult.combinedOutput).toContain('"isPhoneNumber": true');

    const agreementResult = runCli([
      'eval',
      '--code',
      "const p=getCurrentPages().at(-1); p.onCheckChange({detail:{value:'agree'}}); return p.data;",
    ], {
      artifactDir: artifactDir!,
      label: 'agree-protocol',
    });
    expect(agreementResult.combinedOutput).toContain('"isCheck": true');
    expect(agreementResult.combinedOutput).toContain('"isSubmit": true');

    const pageDataResult = runCli(['page-data'], {
      artifactDir: artifactDir!,
      label: 'page-data-ready',
    });
    expect(pageDataResult.combinedOutput).toContain('"phoneNumber": "13800138000"');
    expect(pageDataResult.combinedOutput).toContain('"radioValue": "agree"');

    const clickResult = runCli(['click', '--selector', '.login__button button'], {
      artifactDir: artifactDir!,
      label: 'submit-login',
    });
    expect(clickResult.combinedOutput).toContain('点击: .login__button button');

    const networkResult = runCli(['network', '--urlPattern', 'getSendMessage'], {
      artifactDir: artifactDir!,
      label: 'network-list',
    });
    expect(networkResult.combinedOutput).toContain('/login/getSendMessage');

    const networkDetailResult = runCli(['network-detail', 'req_1'], {
      artifactDir: artifactDir!,
      label: 'network-detail',
    });
    expect(networkDetailResult.combinedOutput).toContain('URL: /login/getSendMessage');
    expect(networkDetailResult.combinedOutput).toContain('"message": "发送成功"');
  });
});

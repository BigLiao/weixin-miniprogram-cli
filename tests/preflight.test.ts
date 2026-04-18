import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readAppId } from '../src/commands/config.js';
import { validateProjectPath } from '../src/utils/preflight.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempProject(config?: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'wx-mp-cli-test-'));
  tempDirs.push(dir);
  if (config) {
    writeFileSync(join(dir, 'project.config.json'), JSON.stringify(config, null, 2), 'utf-8');
  }
  return dir;
}

describe('validateProjectPath', () => {
  it('returns the resolved path for a valid miniprogram project', () => {
    const projectDir = createTempProject({ appid: 'wx123' });

    expect(validateProjectPath(projectDir)).toBe(resolve(projectDir));
  });

  it('throws when project.config.json is missing', () => {
    const projectDir = createTempProject();
    mkdirSync(join(projectDir, 'pages'));

    expect(() => validateProjectPath(projectDir)).toThrow('未找到 project.config.json');
  });
});

describe('readAppId', () => {
  it('reads appid from project.config.json', () => {
    const projectDir = createTempProject({ appid: 'wx-demo-appid' });

    expect(readAppId(projectDir)).toBe('wx-demo-appid');
  });

  it('returns null when appid cannot be read', () => {
    const projectDir = createTempProject({ compileType: 'miniprogram' });

    expect(readAppId(projectDir)).toBeNull();
  });
});

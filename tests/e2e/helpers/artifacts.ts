import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

function normalizeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

export function createArtifactDir(name: string): string {
  const dir = resolve(repoRoot, 'artifacts', 'e2e', `${name}-${normalizeTimestamp(new Date().toISOString())}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeArtifact(dir: string, filename: string, content: string): string {
  const filePath = resolve(dir, filename);
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function appendArtifact(dir: string, filename: string, content: string): string {
  const filePath = resolve(dir, filename);
  appendFileSync(filePath, content, 'utf-8');
  return filePath;
}

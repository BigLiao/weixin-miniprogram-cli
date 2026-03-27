#!/usr/bin/env node

/**
 * 全量集成测试运行器
 * 依次运行所有测试脚本，汇总结果
 *
 * 用法: node examples/test-scripts/run-all.mjs
 */

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 按顺序运行的测试文件
const testFiles = [
  'test-connection.mjs',
  'test-page.mjs',
  'test-input.mjs',
  'test-navigate.mjs',
  'test-assert.mjs',
  'test-console.mjs',
  'test-network.mjs',
  'test-screenshot-script.mjs',
  'test-diagnose.mjs',
];

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║  wx-mp-cli 全量集成测试            ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

let passed = 0;
let failed = 0;
const results = [];

for (const file of testFiles) {
  const filePath = join(__dirname, file);
  const label = file.replace('test-', '').replace('.mjs', '');

  process.stdout.write(`▶ ${label.padEnd(25)}`);

  try {
    execSync(`node "${filePath}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
      cwd: join(__dirname, '../..'),
    });
    passed++;
    results.push({ name: label, status: '✅ PASS' });
    console.log('✅ PASS');
  } catch (e) {
    failed++;
    results.push({ name: label, status: '❌ FAIL' });
    console.log('❌ FAIL');

    // 显示失败输出
    if (e.stdout) {
      const output = e.stdout.toString().split('\n').slice(-5).join('\n');
      console.log(`   ${output}`);
    }
    if (e.stderr) {
      console.log(`   ${e.stderr.toString().slice(0, 200)}`);
    }
  }
}

// 汇总
console.log('');
console.log('═'.repeat(50));
console.log(`📊 总计: ${testFiles.length} 组, ✅ ${passed} 通过, ❌ ${failed} 失败`);
console.log('═'.repeat(50));

for (const r of results) {
  console.log(`   ${r.status}  ${r.name}`);
}
console.log('');

process.exit(failed === 0 ? 0 : 1);

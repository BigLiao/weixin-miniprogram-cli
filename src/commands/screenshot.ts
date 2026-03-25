/**
 * 截图命令 (1个)
 * screenshot
 */

import { defineCommand, type CommandDef } from '../registry.js';
import * as out from '../utils/output.js';
import * as fs from 'fs';
import * as path from 'path';

export const screenshot: CommandDef = defineCommand({
  name: 'screenshot',
  description: '页面截图（保存到文件或输出 base64）',
  category: '截图',
  args: [
    { name: 'path', type: 'string', description: '保存路径（默认 ./screenshot.png）' },
  ],
  handler: async (args, ctx) => {
    ctx.ensurePage();

    const savePath = args.path || './screenshot.png';
    const absPath = path.resolve(savePath);

    try {
      // 确保目录存在
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await ctx.currentPage!.screenshot({ path: absPath });
      const stat = fs.statSync(absPath);
      const sizeKb = (stat.size / 1024).toFixed(1);

      return out.success(`截图已保存: ${absPath} (${sizeKb} KB)`);
    } catch (e: any) {
      return out.error(`截图失败: ${e.message}`);
    }
  },
});

export const screenshotCommands: CommandDef[] = [
  screenshot,
];

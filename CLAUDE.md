# CLAUDE.md

## 项目概述

weixin-miniprogram-cli 是一个微信开发者工具交互式 CLI 控制器，用于 AI Agent 自动化操控微信小程序。

- **语言**: TypeScript (ES Modules)
- **构建输出**: `build/` 目录
- **包名**: `weixin-miniprogram-cli`
- **CLI 命令**: `weixin-miniprogram-cli` 或 `wx-mp-cli`（别名）

## 常用命令

```bash
npm run build      # 编译 TypeScript → build/
npm run dev        # 开发模式直接运行 TS
npm run watch      # 监听编译
npm run clean      # 清理 build/
```

## 项目结构

- `src/` — TypeScript 源码
  - `cli.ts` — CLI 入口
  - `daemon.ts` — 后台守护进程
  - `client.ts` — 守护进程客户端
  - `commands/` — 命令实现
  - `utils/` — 工具函数
- `build/` — 编译产物（git 忽略）
- `examples/` — 示例和测试脚本
- `skills/` — Claude Code skill 定义

## 发布流程

### 前置准备（仅需一次）

1. 在 [npmjs.com](https://www.npmjs.com/) 生成 Access Token（类型选 **Automation**）
2. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加 secret：
   - Name: `NPM_TOKEN`
   - Value: 上一步生成的 token

### 发布新版本

```bash
# 1. 升级版本号（自动创建 git commit + tag）
npm version patch   # 修复版本 0.1.0 → 0.1.1
npm version minor   # 功能版本 0.1.0 → 0.2.0
npm version major   # 大版本   0.1.0 → 1.0.0

# 2. 推送代码和 tag
git push && git push --tags
```

推送 `v*` tag 后，GitHub Actions 会自动：
1. 安装依赖并构建
2. 发布到 npm（`npm publish --access public`）
3. 创建 GitHub Release（自动生成 release notes）

### CI 说明

- **`ci.yml`** — push/PR 到 main 时自动在 Node 16/18/20 上构建验证
- **`publish.yml`** — 推送 `v*` tag 时自动发布到 npm + 创建 GitHub Release

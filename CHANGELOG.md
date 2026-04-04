# Changelog

## [1.1.1] - 2026-04-04

### Bug Fixes

- **WSL 开发者工具 CLI 检测**: 修复在 WSL 环境下定位和调用微信开发者工具 CLI 的兼容性问题，补充环境识别与诊断输出
- **Windows 打开流程**: 优化 Windows 下打开项目并连接自动化端口的流程，提升冷启动和连接成功率
- **CLI 细节修复**: 改进 `ide open` 错误处理、daemon `EPIPE` 容错、命令行转义解析和临时路径常量的跨平台行为

### CI

- **无 lockfile 安装**: 将 CI 和发布流程中的依赖安装从 `npm ci` 调整为 `npm install`，适配当前仓库未提交 lockfile 的发布方式

## [1.1.0] - 2026-04-03

### Features

- **CI 密钥管理**: 新增代码上传密钥管理，密钥按 appid 存储在 `~/.weixin-miniprogram-cli/keys/`，preview/upload/build-npm 等命令自动检查并提示 ([50259fd](https://github.com/BigLiao/weixin-miniprogram-cli/commit/50259fd))
- **配置目录迁移**: 全局配置从 `~/.wx-mp-cli-config.json` 迁移到 `~/.weixin-miniprogram-cli/config.json`，兼容旧配置自动迁移 ([50259fd](https://github.com/BigLiao/weixin-miniprogram-cli/commit/50259fd))
- **eval 命令增强**: 支持 `--code`/`--script` 参数，可执行内联代码或 JS 文件；daemon 自动输出 exception ([bea5a18](https://github.com/BigLiao/weixin-miniprogram-cli/commit/bea5a18))
- **automator-eval 命令**: 新增 automator-eval，通过 automator API 在小程序中执行 JS ([ca9f8a0](https://github.com/BigLiao/weixin-miniprogram-cli/commit/ca9f8a0))
- **snapshot 重构**: 改为读取 WXML 源码 + page.data()，去掉 UID 改用 CSS selector，输出更精简 ([7003196](https://github.com/BigLiao/weixin-miniprogram-cli/commit/7003196))
- **命令体验优化**: 命令注册支持 longDescription、examples；help 展示详细说明和自定义示例 ([210d9a6](https://github.com/BigLiao/weixin-miniprogram-cli/commit/210d9a6))

### Refactoring

- **network 监听重构**: 使用 `mockWxMethod`/`restoreWxMethod` 替代 `Object.defineProperty` 注入，拦截更可靠，stop 真正恢复原始方法；新增 200 条环形缓冲区 ([bee0453](https://github.com/BigLiao/weixin-miniprogram-cli/commit/bee0453))
- **doctor 优化**: 移除硬编码 9420 端口检查和"开发者工具未启动"警告 ([bee0453](https://github.com/BigLiao/weixin-miniprogram-cli/commit/bee0453))

### Bug Fixes

- 修复 pagePath 前导斜杠、util.inspect 替换、警告提示路径问题 ([10a69b3](https://github.com/BigLiao/weixin-miniprogram-cli/commit/10a69b3))
- script.ts examples 类型适配 `{cmd, desc}` 格式 ([c67b70b](https://github.com/BigLiao/weixin-miniprogram-cli/commit/c67b70b))

## [1.0.0] - 2026-03-30

首次正式发布。

- CLI 入口 `wx-mp-cli` / `weixin-miniprogram-cli`
- Daemon 多 Session 架构，支持多项目并行
- 连接管理: open、reconnect、close、status
- 页面操作: snapshot、page、query、click、fill、hover、scroll、wait
- 页面导航: goto、go-back、relaunch
- 断言验证: assert-text、assert-attr、assert-state
- 网络/Console 监控: network、console 系列命令
- IDE 管理: login、preview、upload、build-npm 等
- 截图、eval 脚本执行、Storage 管理
- 环境诊断: doctor
- Claude Code Skill 集成: install-skill

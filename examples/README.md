# Examples

## miniprogram-demo

自定义的微信小程序示例项目，用于 CLI 手工联调和集成验证。

### 项目结构

- 3 个 Tab 页面：首页 (`pages/home/index`)、消息 (`pages/message/index`)、我的 (`pages/my/index`)
- 多个子包页面：搜索、聊天、登录、设置等
- 使用 TDesign 组件库

### 使用前准备

```bash
# 1. 启动开发者工具并打开项目
npm run launch

# 或手动：用微信开发者工具打开 examples/miniprogram-demo/ 目录
# 确保开启：设置 → 安全 → 服务端口
```

仓库测试现已迁移到根目录的 `vitest` 单元测试，运行方式为：

```bash
npm test
```

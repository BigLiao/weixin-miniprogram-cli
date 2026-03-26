# Examples

## miniprogram-demo

自定义的微信小程序示例项目，用于 CLI 集成测试。

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

## test-scripts

CLI 集成测试脚本，覆盖全部命令。

| 测试文件 | 覆盖命令 | 数量 |
|---------|---------|------|
| test-connection.mjs | open/reconnect/close/status | 4 |
| test-page.mjs | page/query/wait/snapshot | 4 |
| test-input.mjs | click/fill/value/set-value | 4 |
| test-navigate.mjs | goto/go-back/switch-tab/relaunch | 4 |
| test-assert.mjs | assert-text/assert-attr/assert-state | 3 |
| test-console.mjs | console/console-detail | 2 |
| test-network.mjs | network/network-detail/network-clear/network-stop | 4 |
| test-screenshot-script.mjs | screenshot/eval | 2 |
| test-diagnose.mjs | diagnose/check-env/debug-elements/debug-connect | 4 |

### 运行测试

```bash
# 全部测试
npm run test:all

# 单组测试
npm run test:connection
npm run test:page
npm run test:diagnose
```

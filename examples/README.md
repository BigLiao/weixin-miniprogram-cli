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

CLI 集成测试脚本，覆盖全部 31 个命令。

| 测试文件 | 覆盖命令 | 数量 |
|---------|---------|------|
| test-connection.mjs | connect/reconnect/disconnect/status | 4 |
| test-page.mjs | get_current_page/query_selector/wait_for/get_page_snapshot | 4 |
| test-input.mjs | click/input_text/get_value/set_form_control | 4 |
| test-navigate.mjs | navigate_to/navigate_back/switch_tab/relaunch | 4 |
| test-assert.mjs | assert_text/assert_attribute/assert_state | 3 |
| test-console.mjs | list_console_messages/get_console_message | 2 |
| test-network.mjs | list/get/clear/stop_network | 4 |
| test-screenshot-script.mjs | screenshot/evaluate_script | 2 |
| test-diagnose.mjs | diagnose/check_env/debug_elements/debug_flow | 4 |

### 运行测试

```bash
# 全部测试
npm run test:all

# 单组测试
npm run test:connection
npm run test:page
npm run test:diagnose
```

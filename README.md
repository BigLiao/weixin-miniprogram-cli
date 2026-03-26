# wx-devtools-cli

微信开发者工具命令行控制器。通过 daemon 后台进程持有连接，每条命令独立执行，支持页面操作、断言验证、网络监控、截图等 43 个命令。

基于 [miniprogram-automator](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/) SDK 实现。

## 快速开始

### 安装

```bash
git clone <repo-url>
cd wx-devtools-cli
npm install
npm run build
```

### 前置条件

- **Node.js** >= 16
- **微信开发者工具** 已安装，且开启以下设置：
  - 设置 → 安全 → **服务端口**：已开启

### 使用

```bash
# 连接项目（启动后台 daemon 并连接）
wx-devtools-cli connect /path/to/your/miniprogram

# 执行命令（每条都是独立的终端命令）
wx-devtools-cli get_page_snapshot
wx-devtools-cli click --uid "button.submit"
wx-devtools-cli screenshot --path ./shot.png
wx-devtools-cli switch_tab --url pages/message/index

# 断开连接
wx-devtools-cli disconnect

# 停止后台 daemon
wx-devtools-cli daemon stop
```

## 架构

```
┌──────────────┐  Unix Socket   ┌──────────────────────────┐
│  wx-devtools-cli CMD  │ ──────────────▶│  daemon (后台进程)         │
│  (独立命令)   │◀────────────── │  - 持有 miniProgram 连接   │
└──────────────┘    JSON        │  - 维护 elementMap/状态    │
                                │  - 监听 console/network    │
                                └──────────────────────────┘
```

`wx-devtools-cli connect` 会自动启动 daemon 进程，后续命令通过 Unix Socket 与 daemon 通信。连接状态、元素映射等都保持在 daemon 中，跨命令共享。

## 使用方式

### 方式一：Daemon 模式（推荐）

```bash
# 1. 连接项目（自动启动 daemon）
wx-devtools-cli connect examples/miniprogram-demo

# 2. 执行任意命令
wx-devtools-cli status
wx-devtools-cli get_page_snapshot
wx-devtools-cli click --uid "button.submit"

# 3. 完成后断开
wx-devtools-cli disconnect

# 4. 停止 daemon（可选，空闲 30 分钟会自动退出）
wx-devtools-cli daemon stop
```

适合 Claude Code、脚本调用等场景。

### 方式二：REPL 交互模式

```bash
wx-devtools-cli --repl
```

进入交互式命令行，支持 Tab 补全、命令历史、自动连接/断开。

### 方式三：单命令执行（无需连接）

```bash
# 这些命令不需要 daemon，直接本地执行
wx-devtools-cli help
wx-devtools-cli check_environment
wx-devtools-cli ide islogin
wx-devtools-cli ide open --project /path/to/project
wx-devtools-cli config
```

### Daemon 管理

```bash
wx-devtools-cli daemon status    # 查看 daemon 状态
wx-devtools-cli daemon stop      # 停止 daemon
```

## REPL 特性

```
● pages/home/index wx>
│ │                 │
│ │                 └── 输入提示符
│ └──────────────────── 当前页面路径
└────────────────────── 连接状态（● 已连接 / ○ 未连接）
```

- **Tab 补全** — 命令名、子命令、参数名自动补全
- **命令历史** — 上下箭头翻阅，`history` 查看最近 20 条
- **自动连接** — 启动时如有默认项目，自动连接
- **自动断开** — `exit` / Ctrl+D 退出时自动断开

## 命令总览

### 连接管理

| 命令 | 说明 |
|------|------|
| `connect_devtools --project <path>` | 连接到开发者工具 |
| `reconnect_devtools` | 重新连接（复用上次参数） |
| `disconnect_devtools` | 断开连接 |
| `status` | 查看当前连接状态 |

### 页面查询与快照

| 命令 | 说明 |
|------|------|
| `get_current_page` | 获取当前页面信息 |
| `get_page_snapshot` | 获取页面快照，生成元素 UID |
| `query_selector --selector <css>` | 通过选择器查找元素 |
| `wait_for --selector <css>` | 等待元素出现/消失/文本匹配 |

### 交互操作

| 命令 | 说明 |
|------|------|
| `click --uid <uid>` | 点击元素 |
| `input_text --uid <uid> --text <text>` | 输入文本 |
| `get_value --uid <uid>` | 获取元素值 |
| `set_form_control --uid <uid> --value <val>` | 设置表单控件值 |

### 断言验证

| 命令 | 说明 |
|------|------|
| `assert_text --uid <uid> --text <text>` | 断言文本内容（精确/包含/正则） |
| `assert_attribute --uid <uid> --key <k> --value <v>` | 断言属性值 |
| `assert_state --uid <uid> --visible` | 断言状态（可见/启用/选中/焦点） |

### 页面导航

| 命令 | 说明 |
|------|------|
| `navigate_to --url <page>` | 导航到指定页面 |
| `navigate_back` | 返回上一页 |
| `switch_tab --url <tab_page>` | 切换 Tab |
| `relaunch --url <page>` | 重启小程序到指定页面 |

### Console 监控

| 命令 | 说明 |
|------|------|
| `list_console_messages` | 列出 console 消息（分页/过滤） |
| `get_console_message --msgid <id>` | 获取消息详情 |

### 网络监控

| 命令 | 说明 |
|------|------|
| `list_network_requests` | 列出网络请求（分页/过滤） |
| `get_network_request --reqid <id>` | 获取请求详情 |
| `stop_network_monitoring` | 停止监控 |
| `clear_network_requests` | 清除请求记录 |

### 截图与脚本

| 命令 | 说明 |
|------|------|
| `screenshot --path <file>` | 页面截图 |
| `evaluate_script --script <js>` | 在页面中执行 JS |

### IDE 管理（`ide` 命名空间）

通过开发者工具 CLI 控制 IDE 本身：

| 命令 | 说明 |
|------|------|
| `ide open --project <path>` | 打开项目 |
| `ide login` | 登录（终端显示二维码） |
| `ide islogin` | 检查登录状态 |
| `ide preview --project <path>` | 预览（生成二维码） |
| `ide auto-preview` | 自动预览 |
| `ide upload --version <ver>` | 上传代码 |
| `ide build-npm` | 构建 NPM |
| `ide auto --project <path>` | 启用自动化端口 |
| `ide close` | 关闭项目窗口 |
| `ide quit` | 退出开发者工具 |
| `ide cache` | 清除缓存 |

### 诊断工具

| 命令 | 说明 |
|------|------|
| `check_environment` | 检查运行环境 |
| `diagnose_connection --project <path>` | 诊断连接问题 |
| `debug_page_elements` | 调试页面元素选择器 |
| `debug_connection_flow --project <path>` | 连接流程逐步追踪 |

### 配置

| 命令 | 说明 |
|------|------|
| `config` | 查看当前配置 |
| `config --cliPath <path>` | 设置开发者工具 CLI 路径 |
| `config --defaultProject <path>` | 设置默认项目路径 |
| `config --reset` | 重置配置 |

任何命令都可以通过 `help <command>` 查看详细用法，如 `help click`、`help ide upload`。

## 典型操作流程

### 自动化测试

```bash
wx-devtools-cli connect examples/miniprogram-demo
wx-devtools-cli get_page_snapshot                            # 获取页面快照和元素 UID
wx-devtools-cli click --uid "view.home-release"              # 点击发布按钮
wx-devtools-cli wait_for --selector ".modal" --timeout 3000  # 等待弹窗出现
wx-devtools-cli assert_text --uid ".title" --text "发布"      # 断言标题
wx-devtools-cli screenshot --path ./result.png                # 截图保存
wx-devtools-cli disconnect
```

### 调试网络请求

```bash
wx-devtools-cli list_network_requests --urlPattern "/api/" --failedOnly
wx-devtools-cli get_network_request --reqid req_3
```

### 监控 Console 错误

```bash
wx-devtools-cli list_console_messages --types error,exception
wx-devtools-cli get_console_message --msgid 5
```

### IDE 管理

```bash
# 不需要 daemon，直接本地执行
wx-devtools-cli ide open --project /path/to/project
wx-devtools-cli ide login
wx-devtools-cli ide upload --version 1.0.0 --desc "first release"
```

## UID 引用机制

`get_page_snapshot` 会为页面中的每个元素生成唯一的 UID（基于 CSS 选择器）。后续的操作命令通过 `--uid` 引用元素，无需重复编写选择器：

```
wx> get_page_snapshot
✅ 快照获取成功，共 24 个元素
  #login-btn → #login-btn[0]
  view.card → view.card[0]
  input.username → input.username[0]

wx> click --uid "#login-btn"
wx> input_text --uid "input.username" --text "test"
```

执行导航后元素映射会自动清除，需重新获取快照。

## 示例项目

仓库内置了一个小程序示例项目 `examples/miniprogram-demo/`，包含 3 个 Tab 页面和多个子包，用于测试和演示。

```bash
# 检查示例项目
npm run setup

# 启动 IDE 打开项目（含登录检查）
npm run test:launch

# 连接并操作
wx-devtools-cli connect examples/miniprogram-demo
```

## 测试

```bash
# 全量集成测试（9 组，覆盖 43 个命令）
npm run test:all

# 单组测试
npm run test:connection    # 连接管理
npm run test:page          # 页面查询
npm run test:input         # 交互操作
npm run test:navigate      # 页面导航
npm run test:assert        # 断言验证
npm run test:console       # Console 监控
npm run test:network       # 网络监控
npm run test:screenshot    # 截图 + 脚本
npm run test:diagnose      # 诊断工具
npm run test:launch        # IDE 启动流程
```

运行集成测试前需确保微信开发者工具已打开示例项目。

## 配置

配置持久化到 `~/.wx-devtools-cli-config.json`。

### IDE CLI 路径自动检测

自动扫描以下路径，无需手动配置：

| 系统 | 路径 |
|------|------|
| macOS | `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` |
| macOS | `/Applications/微信开发者工具.app/Contents/MacOS/cli` |
| Windows | `C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat` |

也可通过环境变量 `WECHAT_DEVTOOLS_CLI` 或 `config --cliPath` 手动指定。

## 项目结构

```
wx-devtools-cli/
├── src/
│   ├── cli.ts                 # CLI 入口（命令分发）
│   ├── daemon.ts              # Daemon 后台服务（Unix Socket）
│   ├── client.ts              # IPC 客户端（与 daemon 通信）
│   ├── constants.ts           # 共享常量（socket/pid 路径）
│   ├── context.ts             # 共享状态
│   ├── registry.ts            # 命令注册表
│   ├── parser.ts              # 命令解析器
│   ├── commands/              # 43 个命令实现
│   │   ├── connection.ts      # 连接管理
│   │   ├── page.ts            # 页面查询
│   │   ├── snapshot.ts        # 页面快照
│   │   ├── input.ts           # 交互操作
│   │   ├── assert.ts          # 断言验证
│   │   ├── navigate.ts        # 页面导航
│   │   ├── console.ts         # Console 监控
│   │   ├── network.ts         # 网络监控
│   │   ├── screenshot.ts      # 截图
│   │   ├── script.ts          # 脚本执行
│   │   ├── ide.ts             # IDE 管理
│   │   ├── diagnose.ts        # 诊断工具
│   │   └── config.ts          # 配置管理
│   └── utils/
│       ├── output.ts          # 彩色输出
│       ├── uid.ts             # UID 生成
│       └── ide-cli.ts         # IDE CLI 调用封装
├── examples/
│   ├── miniprogram-demo/      # 示例小程序
│   ├── test-scripts/          # 集成测试脚本
│   ├── setup.mjs              # 环境检查
│   └── launch.mjs             # IDE 启动脚本
├── package.json
└── tsconfig.json
```

## License

MIT

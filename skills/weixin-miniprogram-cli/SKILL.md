---
name: weixin-miniprogram-cli
description: 当需要自动化操作微信开发者工具时使用，可用于开发调试、测试自动化、持续集成，提供能力：打开项目、页面导航、点击元素、表单填写、内容断言、截图、查看网络请求和控制台日志、预览、上传等。
allowed-tools: Bash(wx-mp-cli:*)
---

# weixin-miniprogram-cli Skill

## Quick Start

```bash
# 先诊断环境
wx-mp-cli doctor
# 查看全部命令
wx-mp-cli help --detail
```

如果找不到 `wx-mp-cli` 命令，执行 `npm install -g weixin-miniprogram-cli` 安装。

典型流程：

```bash
wx-mp-cli open /path/to/miniprogram
wx-mp-cli launch --auto-port 9420
wx-mp-cli snapshot
wx-mp-cli click ".submit-btn"
wx-mp-cli wait --selector ".success"
wx-mp-cli assert-text ".title" --textContains "成功"
wx-mp-cli screenshot --path ./result.png
wx-mp-cli close
```

## Operational Rules

- `open` 只负责 IDE / 项目窗口生命周期；需要自动化操作前，再执行 `launch`。
- `open --port` 是 IDE HTTP 端口，`launch --auto-port` 是 automator WebSocket 端口，不要混用。
- 交互前先 `snapshot`，获取页面元素树和 CSS selector。
- 页面跳转/返回/重启后，重新 `snapshot`，不复用旧 selector。
- 参数不确定时 `help <command>`，不要 `help --detail`。
- 任务依赖 IDE 项目目标但用户未提供时，先确认项目路径或 AppID。
- 截图审查 UI 后删除临时文件。任务结束后 `close`。

## Task Playbooks

### 页面检查与定位

```bash
wx-mp-cli snapshot          # 获取元素树
wx-mp-cli page              # 当前页面信息
wx-mp-cli query ".target"   # 查找元素
```

### 导航与断言

```bash
wx-mp-cli goto "pages/list/index"
wx-mp-cli snapshot
wx-mp-cli click ".item"
wx-mp-cli wait --selector ".detail-page" --timeout 10000
wx-mp-cli assert-text ".detail-title" --text "预期标题"
wx-mp-cli go-back
```

### 表单填写

```bash
wx-mp-cli fill ".username" --text "testuser"
wx-mp-cli fill ".password" --text "password123"
wx-mp-cli click ".login-btn"
wx-mp-cli wait --selector ".home-page" --timeout 10000
wx-mp-cli assert-text ".welcome" --textContains "testuser"
```

### 预览、上传与构建

```bash
wx-mp-cli preview --project /path/to/miniprogram
wx-mp-cli preview --appid wx1234567890
wx-mp-cli upload --project /path/to/miniprogram --version 1.0.0 --desc "release"
wx-mp-cli upload --appid wx1234567890 --version 1.0.0 --desc "release"
wx-mp-cli build-npm --project /path/to/miniprogram --compile-type plugin
wx-mp-cli auto --project /path/to/miniprogram --auto-account <openid>
```

### 网络请求调试

```bash
wx-mp-cli relaunch "pages/home/home"  # 重新触发请求
wx-mp-cli network                      # 列出请求
wx-mp-cli network --urlPattern "api/user"
wx-mp-cli network-detail req_1         # 查看详情
wx-mp-cli network-clear                # 清除日志
```

连接时自动启动监听，无需额外操作。

### Console 日志调试

```bash
wx-mp-cli console --types "error,warn"
wx-mp-cli console-detail 1
```

### Storage 数据管理

```bash
wx-mp-cli storage --action list
wx-mp-cli storage --action get --key "token"
wx-mp-cli storage --action set --key "debug" --value '{"enabled":true}'
wx-mp-cli storage --action remove --key "token"
```

### 脚本执行

```bash
wx-mp-cli eval --script "wx.getSystemInfoSync()"
```

### 多 Session 管理

```bash
wx-mp-cli session list --probe
wx-mp-cli session use --id s2
```

### 环境诊断与恢复

```bash
wx-mp-cli doctor
wx-mp-cli status
wx-mp-cli close --session s2
wx-mp-cli open /path/to/miniprogram --session s2
wx-mp-cli launch --session s2 --auto-port 9420
```

## Failure Handling

- 环境或连接异常：先 `doctor`。
- 登录问题：先 `islogin` 或 `login --qr-size default`。
- 元素找不到：重新 `snapshot`，确认 selector 有效，使用唯一 selector。
- 网络请求为空：尝试 `relaunch` 重新加载页面。
- daemon 挂掉：`daemon stop` 后重新 `open`，再执行 `launch`。
- 长流程中断：保留截图或断言结果，向用户说明失败步骤。

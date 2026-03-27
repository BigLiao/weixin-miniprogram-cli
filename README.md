# weixin-miniprogram-cli

[![npm version](https://img.shields.io/npm/v/weixin-miniprogram-cli.svg)](https://www.npmjs.com/package/weixin-miniprogram-cli)
[![npm downloads](https://img.shields.io/npm/dm/weixin-miniprogram-cli.svg)](https://www.npmjs.com/package/weixin-miniprogram-cli)
[![license](https://img.shields.io/npm/l/weixin-miniprogram-cli.svg)](https://github.com/BigLiao/weixin-miniprogram-cli/blob/main/LICENSE)

专为 AI Coding Agent 设计的微信小程序自动化 CLI。配合 Skill 使用，打通开发、测试、部署的全流程。

## 安装

推荐通过 npm 全局安装：

```bash
npm install -g weixin-miniprogram-cli
```

或从源码手动安装：

```bash
git clone https://github.com/BigLiao/weixin-miniprogram-cli.git
cd weixin-miniprogram-cli
npm install && npm run build && npm link
```

**前置条件：** Node.js >= 16，已安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)并开启 **设置 → 安全设置 → 服务端口**。


## 基本使用

安装完后可以通过命令操作微信开发者工具来实现自动化。

```bash
wx-mp-cli open ./my-miniprogram
wx-mp-cli snapshot                        # 获取页面元素
wx-mp-cli click "button.submit"           # 通过 UID 交互
wx-mp-cli assert-text ".title" --text "成功"
wx-mp-cli screenshot --path ./result.png
wx-mp-cli close
```


## 安装 Skill

搭配专用 Skill 使用，实现 AI 完全自动化开发小程序。

通过自带命令可以自动安装 Skill。

```bash
wx-mp-cli install-skill              # 安装到当前项目 .claude/skills/
wx-mp-cli install-skill --universal  # 安装到 .agent/skills/（跨 agent 通用）
wx-mp-cli install-skill --global     # 安装到 ~/.claude/skills/（用户全局）
```


## 命令一览

执行 `wx-mp-cli help <command>` 查看完整参数。

### 连接

```bash
wx-mp-cli open ./my-miniprogram    # 连接开发者工具（自动启动 daemon）
wx-mp-cli close                    # 断开连接
wx-mp-cli reconnect                # 用上次的参数重连
wx-mp-cli status                   # 查看连接状态
```

### 快照与查询

```bash
wx-mp-cli snapshot                         # 页面元素树 + UID
wx-mp-cli page                             # 当前页面信息
wx-mp-cli query ".search-input"            # 按选择器查找元素
wx-mp-cli wait --selector ".modal"         # 等待元素出现
```

`snapshot` 返回页面所有元素及自动生成的 UID，后续命令用 UID 操作元素。页面跳转后需重新执行。

### 交互

```bash
wx-mp-cli click "button.submit"                    # 点击
wx-mp-cli fill "input.username" --text "test"      # 输入文本
wx-mp-cli value "input.username"                   # 读取值
wx-mp-cli set-value "picker.date" --value "2025-01-01"  # 设置表单控件
wx-mp-cli hover "view.card"                        # 长按
wx-mp-cli press "Enter"                            # 键盘事件
wx-mp-cli drag --fromUid "item.1" --toUid "item.3" # 拖拽
```

### 导航

```bash
wx-mp-cli goto "pages/detail/index"        # 跳转页面
wx-mp-cli go-back                          # 返回
wx-mp-cli switch-tab "pages/home/index"    # 切换 Tab
wx-mp-cli relaunch "pages/home/index"      # 重启到指定页面
wx-mp-cli scroll 500                       # 滚动到指定位置（px）
```

### 断言

```bash
wx-mp-cli assert-text ".title" --text "你好"               # 精确匹配
wx-mp-cli assert-text ".desc" --textContains "欢迎"        # 包含
wx-mp-cli assert-text ".code" --textMatches "v\\d+\\.\\d+"   # 正则
wx-mp-cli assert-attr ".btn" --key class --value active    # 属性断言
wx-mp-cli assert-state ".modal" --visible                  # 可见性
```

### 截图与脚本

```bash
wx-mp-cli screenshot --path ./shot.png     # 截图
wx-mp-cli eval "return wx.getSystemInfoSync()"  # 在页面执行 JS
```

### 控制台与网络

```bash
wx-mp-cli console                          # 控制台日志
wx-mp-cli console --types error            # 按类型过滤
wx-mp-cli console-detail 5                 # 日志详情
wx-mp-cli network                          # 网络请求列表
wx-mp-cli network --failedOnly             # 仅失败请求
wx-mp-cli network-detail "req_3"           # 请求详情
wx-mp-cli network-clear                    # 清空记录
```

### 存储

```bash
wx-mp-cli storage --action list
wx-mp-cli storage --action get --key userToken
wx-mp-cli storage --action set --key theme --value '"dark"'
wx-mp-cli storage --action remove --key tempData
wx-mp-cli storage --action clear
```

### CI / IDE 控制

本地执行，无需 daemon——直接控制开发者工具 IDE：

```bash
wx-mp-cli ci open --project ./my-app       # 打开项目
wx-mp-cli ci login                         # 登录（终端显示二维码）
wx-mp-cli ci islogin                       # 检查登录状态
wx-mp-cli ci upload --version 1.0.0        # 上传代码
wx-mp-cli ci preview --project ./my-app    # 预览（生成二维码）
wx-mp-cli ci build-npm                     # 构建 NPM
wx-mp-cli ci auto --project ./my-app       # 开启自动化端口
wx-mp-cli ci close                         # 关闭项目窗口
wx-mp-cli ci quit                          # 退出开发者工具
```

### 诊断

```bash
wx-mp-cli check-env                        # 环境检查
wx-mp-cli diagnose --project ./my-app      # 诊断连接问题
```

## 工作原理

`open` 启动后台 daemon 并建立 miniprogram-automator 连接。后续每条命令通过 Unix Socket 与 daemon 通信，执行后即退出。daemon 在命令间持续维护元素映射、控制台日志和网络记录，空闲 30 分钟后自动退出。

## 配置

```bash
wx-mp-cli config                           # 查看配置
wx-mp-cli config --cliPath <path>          # 设置开发者工具 CLI 路径
wx-mp-cli config --defaultProject <path>   # 设置默认项目
```

开发者工具路径在 macOS/Windows 上自动检测，也可通过环境变量 `WECHAT_DEVTOOLS_CLI` 覆盖。

## License

MIT

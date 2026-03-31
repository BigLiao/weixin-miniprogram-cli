---
name: weixin-miniprogram-cli
description: 微信小程序自动化 CLI 工具。当需要操控小程序页面、点击元素、填写表单、截图、执行测试、提取页面信息时使用。
allowed-tools: Bash(wx-mp-cli:*)
---

# 用 wx-mp-cli 自动化微信小程序

## 安装命令（当提示命令不存在时）

```bash
npm install -g weixin-miniprogram-cli
```

## 快速上手

```bash
# 连接小程序
wx-mp-cli open /path/to/miniprogram
# 获取页面 WXML 源码和数据
wx-mp-cli snapshot
# 用 CSS 选择器操作元素
wx-mp-cli click ".btn"
wx-mp-cli fill ".username" --text "test"
# 验证结果
wx-mp-cli assert-text ".title" --text "成功"
# 截图
wx-mp-cli screenshot --path ./result.png
# 断开
wx-mp-cli close
```

## 核心概念

`snapshot` 返回当前页面的 WXML 源码和页面数据 (`page.data()`)。通过阅读 WXML 源码了解页面结构，然后使用 CSS 选择器直接定位元素进行交互：

```
✅ 页面快照获取成功
  页面: pages/index/index

=== WXML 源码 ===
<view class="container">
  <text class="title">{{title}}</text>
  <button class="btn" bindtap="onTap">提交</button>
</view>

=== 页面数据 (data) ===
{
  "title": "Hello World"
}
```

所有交互命令使用 **CSS 选择器** 定位元素：

```bash
wx-mp-cli click ".btn"                    # class 选择器
wx-mp-cli click "#login-btn"              # id 选择器
wx-mp-cli fill "input.username" --text "test"  # 标签+class 组合
```

唯一必填参数支持**位置传参**，无需写 flag：

```bash
wx-mp-cli click ".btn"                   # 等同于 --selector ".btn"
wx-mp-cli goto "pages/detail/index"       # 等同于 --url "pages/detail/index"
wx-mp-cli eval "return 1 + 1"            # 等同于 --script "return 1 + 1"
```

## 命令

### 连接

```bash
wx-mp-cli open /path/to/miniprogram
wx-mp-cli close
wx-mp-cli reconnect
wx-mp-cli status
```

### 快照与查询

```bash
wx-mp-cli snapshot                              # WXML 源码 + 精简版 data
wx-mp-cli snapshot --filePath ./snapshot.txt     # 保存到文件
wx-mp-cli page-data                             # 完整 page.data()
wx-mp-cli page-data --key cardInfo              # 只看指定 key
wx-mp-cli page-data --filePath ./data.json      # 保存到文件
wx-mp-cli page
wx-mp-cli query ".search-input"
wx-mp-cli wait --selector ".modal" --timeout 5000
```

### 交互

```bash
wx-mp-cli click ".btn"
wx-mp-cli click ".item" --dblClick
wx-mp-cli fill ".username" --text "hello"
wx-mp-cli fill ".search" --text "query" --clear
wx-mp-cli value ".username"
wx-mp-cli hover ".card"
```

### 导航

```bash
wx-mp-cli goto "pages/detail/index"
wx-mp-cli goto "pages/detail/index" --params '{"id": "123"}'
wx-mp-cli goto "pages/home/index"   # tabBar 页面自动使用 switchTab
wx-mp-cli go-back
wx-mp-cli relaunch "pages/home/index"
wx-mp-cli scroll 500
```

### 断言

```bash
wx-mp-cli assert-text ".title" --text "你好"
wx-mp-cli assert-text ".desc" --textContains "欢迎"
wx-mp-cli assert-text ".code" --textMatches "v\\d+"
wx-mp-cli assert-attr ".btn" --key class --value active
wx-mp-cli assert-state ".modal" --visible
wx-mp-cli assert-state ".btn" --enabled
```

### 截图与脚本

```bash
wx-mp-cli screenshot
wx-mp-cli screenshot --path ./shot.png
wx-mp-cli eval "return wx.getSystemInfoSync()"
wx-mp-cli eval "return document.title"
```

### 控制台与网络

```bash
wx-mp-cli console
wx-mp-cli console --types error
wx-mp-cli console-detail 5
wx-mp-cli network
wx-mp-cli network --failedOnly
wx-mp-cli network --urlPattern "/api/"
wx-mp-cli network-detail "req_3"
wx-mp-cli network-clear
wx-mp-cli network-stop
```

### 存储

```bash
wx-mp-cli storage --action list
wx-mp-cli storage --action get --key userToken
wx-mp-cli storage --action set --key theme --value '"dark"'
wx-mp-cli storage --action remove --key tempData
wx-mp-cli storage --action clear
```

### 多会话

```bash
wx-mp-cli sessions
wx-mp-cli sessions --probe
wx-mp-cli switch-session "s2"
# 任何命令都可用 --session 指定目标会话
wx-mp-cli snapshot --session s2
```

### IDE 控制

```bash
wx-mp-cli ide-open --project ./my-app
wx-mp-cli login
wx-mp-cli islogin
wx-mp-cli upload --version 1.0.0
wx-mp-cli preview --project ./my-app
wx-mp-cli build-npm
wx-mp-cli auto --project ./my-app
wx-mp-cli ide-close
wx-mp-cli quit
```

### 诊断

```bash
wx-mp-cli check-env
wx-mp-cli diagnose --project ./my-app
wx-mp-cli debug-elements
wx-mp-cli debug-connect --project ./my-app
```

## 示例：登录流程测试

```bash
wx-mp-cli open /path/to/miniprogram
wx-mp-cli snapshot
wx-mp-cli fill ".username" --text "testuser"
wx-mp-cli fill ".password" --text "password123"
wx-mp-cli click ".login-btn"
wx-mp-cli wait --selector ".home-page" --timeout 10000
wx-mp-cli snapshot
wx-mp-cli assert-text ".welcome" --textContains "testuser"
wx-mp-cli screenshot --path ./login-success.png
wx-mp-cli close
```

## 示例：页面导航与数据验证

```bash
wx-mp-cli open /path/to/miniprogram
wx-mp-cli goto "pages/list/index"
wx-mp-cli snapshot
wx-mp-cli click ".item"
wx-mp-cli wait --selector ".detail-page"
wx-mp-cli snapshot
wx-mp-cli assert-text ".detail-title" --text "预期标题"
wx-mp-cli go-back
wx-mp-cli close
```

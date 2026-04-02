---
name: weixin-miniprogram-cli
description: 当需要操控微信开发者工具来打开小程序、获取页面信息、交互、执行测试、以及打包时使用。能通过 CLI 命令来操作微信开发者工具来实现自动化。
allowed-tools: Bash(wx-mp-cli:*)
---

# weixin-miniprogram-cli Skill

## 前置依赖

先检查当前环境信息：
```bash
wx-mp-cli doctor
```

如果找不到`wx-mp-cli`命令，则通过`npm install -g weixin-miniprogram-cli`安装。

如果环境检查有异常，则提示用户先进行处理。

## 熟悉命令

必须先熟悉所有命令，才能正确使用。

```bash
wx-mp-cli help --detail # 查看所有命令的详细帮助信息
wx-mp-cli help <command> # 查看指定命令的帮助信息
```

## 使用示例

### 示例1：页面导航与数据验证

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



### 示例2：登录流程测试

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

## 诊断

遇到环境问题时，可以使用`wx-mp-cli doctor`命令来诊断环境问题。


```bash
wx-mp-cli doctor    # 环境与连接一键诊断
```
# mp-cli

WeChat Mini-Program automation CLI designed for coding agents.

Each command is a standalone shell call — no SDK imports, no persistent sessions in your agent's context. Connect once, then `snapshot`, `click`, `fill`, `assert-text` as individual commands. Inspired by [Playwright CLI](https://github.com/anthropics/playwright-cli).

```bash
mp-cli open ./my-miniprogram
mp-cli snapshot                        # get page elements
mp-cli click "button.submit"           # interact by UID
mp-cli assert-text ".title" --text "Success"
mp-cli screenshot --path ./result.png
mp-cli close
```

## Why CLI over SDK?

| | SDK (miniprogram-automator) | mp-cli |
|---|---|---|
| Integration | Import library, manage async connections | Shell commands, zero code |
| Agent compatibility | Requires code generation + execution | Works with any agent that can run shell commands |
| State management | Agent must hold connection objects | Daemon holds state across commands |
| Token cost | Load full API schema into context | One-line commands, minimal tokens |
| Element references | CSS selectors everywhere | `snapshot` → UID → positional arg |

## Install

```bash
git clone <repo-url>
cd mp-cli
npm install && npm run build
```

**Prerequisites:** Node.js >= 16, [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) with **Settings → Security → Service Port** enabled.

## Commands

Single required parameter is always **positional** — no flag needed. Run `help <command>` for full options.

### Connection

```bash
mp-cli open ./my-miniprogram    # Connect (auto-starts daemon)
mp-cli close                    # Disconnect
mp-cli reconnect                # Reconnect with previous params
mp-cli status                   # Connection state
```

### Snapshot & Query

```bash
mp-cli snapshot                         # Page tree with element UIDs
mp-cli page                             # Current page info
mp-cli query ".search-input"            # Find element by selector
mp-cli wait --selector ".modal"         # Wait for element to appear
```

`snapshot` returns all page elements with auto-generated UIDs. Use UIDs in subsequent commands. Re-run after navigation.

### Interaction

```bash
mp-cli click "button.submit"                    # Click
mp-cli fill "input.username" --text "test"      # Type into input
mp-cli value "input.username"                   # Get value
mp-cli set-value "picker.date" --value "2025-01-01"  # Set form control
mp-cli hover "view.card"                        # Long press
mp-cli press "Enter"                            # Keyboard event
mp-cli drag --fromUid "item.1" --toUid "item.3" # Drag
```

### Navigation

```bash
mp-cli goto "pages/detail/index"        # Navigate to page
mp-cli go-back                          # Back
mp-cli switch-tab "pages/home/index"    # Switch tab
mp-cli relaunch "pages/home/index"      # Restart to page
mp-cli scroll 500                       # Scroll to position (px)
```

### Assertions

```bash
mp-cli assert-text ".title" --text "Hello"              # Exact match
mp-cli assert-text ".desc" --textContains "welcome"     # Contains
mp-cli assert-text ".code" --textMatches "v\\d+\\.\\d+"   # Regex
mp-cli assert-attr ".btn" --key class --value active    # Attribute
mp-cli assert-state ".modal" --visible                  # Visibility
```

### Screenshot & Script

```bash
mp-cli screenshot --path ./shot.png     # Capture screenshot
mp-cli eval "return wx.getSystemInfoSync()"  # Execute JS in page
```

### Console & Network

```bash
mp-cli console                          # List console messages
mp-cli console --types error            # Filter by type
mp-cli console-detail 5                 # Message details by ID
mp-cli network                          # List requests
mp-cli network --failedOnly             # Failed requests only
mp-cli network-detail "req_3"           # Request details by ID
mp-cli network-clear                    # Clear records
```

### Storage

```bash
mp-cli storage --action list
mp-cli storage --action get --key userToken
mp-cli storage --action set --key theme --value '"dark"'
mp-cli storage --action remove --key tempData
mp-cli storage --action clear
```

### CI / IDE Control

Run locally without daemon — control the DevTools IDE directly:

```bash
mp-cli ci open --project ./my-app       # Open project in IDE
mp-cli ci login                         # Login (QR in terminal)
mp-cli ci islogin                       # Check login status
mp-cli ci upload --version 1.0.0        # Upload code
mp-cli ci preview --project ./my-app    # Preview (QR)
mp-cli ci build-npm                     # Build NPM
mp-cli ci auto --project ./my-app       # Enable automation port
mp-cli ci close                         # Close project window
mp-cli ci quit                          # Quit DevTools
```

### Diagnostics

```bash
mp-cli check-env                        # Check environment
mp-cli diagnose --project ./my-app      # Diagnose connection issues
```

## How It Works

`open` starts a background daemon that holds the miniprogram-automator connection. Each subsequent command connects to the daemon via Unix Socket, executes, and exits. The daemon maintains element mappings, console logs, and network records across commands. Auto-exits after 30 min idle.

## Configuration

```bash
mp-cli config                           # View
mp-cli config --cliPath <path>          # Set DevTools CLI path
mp-cli config --defaultProject <path>   # Set default project
```

DevTools CLI path is auto-detected on macOS/Windows. Override via `WECHAT_DEVTOOLS_CLI` env var.

## License

MIT

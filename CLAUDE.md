# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

wx-devtools-cli is a TypeScript/Node.js CLI automation tool for WeChat mini-programs. It provides 48 commands for page interaction, assertions, network monitoring, screenshots, and IDE management. Built on the `miniprogram-automator` SDK.

## Build & Development Commands

```bash
npm run build          # Compile TypeScript + chmod +x on executables
npm run watch          # Compile on file changes
npm run dev            # Run directly via tsx (no build needed)
npm run start          # Run compiled CLI
```

## Testing

Integration tests require WeChat DevTools running with the example mini-program open (`examples/miniprogram-demo/`).

```bash
npm run test:all           # Run all 9 test suites sequentially
npm run test:connection    # Single test suite example
npm run test:<suite>       # Available: connection, page, input, navigate, assert, console, network, screenshot, diagnose, launch
```

Tests are custom Node.js ESM scripts (`.mjs`) in `examples/test-scripts/` using a hand-written framework from `test-utils.mjs` (describe/assert/run/cleanup pattern). No Jest/Mocha. 60-second timeout per test.

## Architecture

**Daemon-based CLI with Unix Socket IPC:**

```
CLI (cli.ts) → Unix Socket (JSON\n) → Daemon (daemon.ts) → miniprogram-automator SDK
```

- **cli.ts**: Entry point. Parses commands, dispatches local commands directly or sends daemon commands via IPC client. Also hosts REPL mode.
- **daemon.ts**: Long-running background process. Holds the `miniProgram` connection, executes commands, manages state. Auto-starts on first daemon command, auto-stops after 30min idle.
- **client.ts**: IPC client that communicates with daemon over Unix Socket. JSON-over-newline protocol with 120s command timeout.
- **context.ts** (`SharedContext`): Shared mutable state within the daemon — holds `miniProgram` instance, `currentPage`, `elementMap`, console messages, network requests.
- **registry.ts**: Command registration system. Each command declares name, handler, args, and whether it requires daemon.
- **parser.ts**: CLI argument parsing (wraps minimist).

**Command modules** (`src/commands/`): 15 modules implementing 48 commands. Each exports functions that register commands with the registry. Commands are categorized as local (no daemon needed: help, config, CI commands) or daemon-required (connection, page ops, assertions, etc.).

**Key pattern — UID element references**: `snapshot` generates UIDs from CSS selectors (e.g. `button.submit[0]`) stored in `SharedContext.elementMap`. Subsequent commands reference elements by `--uid`. Element map clears on navigation.

**Auto-monitoring**: Console events and network requests are automatically captured via event listeners and `wx.request` proxy injection when connected.

## Key Technical Details

- **ESM modules** (`"type": "module"`) — use `import`/`export`, not `require`
- **TypeScript strict mode** enabled, target ES2022, Node16 module resolution
- **No linter/formatter configured** — rely on TypeScript compiler checks
- **IPC protocol**: `{ command, args }\n` request → `{ ok, output?, error? }\n` response
- **Config persistence**: `~/.wx-devtools-cli-config.json` (IDE CLI path, default project)
- **Socket/PID paths**: defined in `src/constants.ts`, stored in OS temp directory
- **Executables**: `build/cli.js` and `build/daemon.js` have shebangs and `+x` permission

## Command Naming Convention

Commands use **kebab-case** short verbs (Playwright-aligned):
- Connection: `open`, `close`, `reconnect`, `status`
- Navigation: `goto`, `go-back`, `switch-tab`, `relaunch`, `scroll`
- Page: `page`, `snapshot`, `query`, `wait`
- Interaction: `click`, `fill`, `value`, `set-value`, `hover`, `press`, `drag`
- Assertions: `assert-text`, `assert-attr`, `assert-state`
- Console: `console`, `console-detail`
- Network: `network`, `network-detail`, `network-stop`, `network-clear`
- Script: `eval`
- Storage: `storage`
- CI/IDE: `ci open`, `ci login`, `ci islogin`, etc. (11 commands)
- Diagnostics: `diagnose`, `check-env`, `debug-elements`, `debug-connect`
- Session: `sessions`, `switch-session`
- Config: `config`
- Screenshot: `screenshot`

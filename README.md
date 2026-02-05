# Hakimi

[![npm version](https://img.shields.io/npm/v/hakimi.svg)](https://www.npmjs.com/package/hakimi)

Chat with an AI assistant via Telegram/Slack/Feishu to remotely control your computer.

## Prerequisites

Hakimi depends on [Kimi Code CLI](https://github.com/MoonshotAI/kimi-cli). Install it first:

```bash
# Linux/macOS
curl -LsSf https://code.kimi.com/install.sh | bash

# Windows (PowerShell)
Invoke-RestMethod https://code.kimi.com/install.ps1 | Invoke-Expression
```

For detailed instructions, see the [Getting Started Guide](https://moonshotai.github.io/kimi-cli/en/guides/getting-started.html).

## Install

```bash
npm install -g hakimi
```

## Usage

```bash
hakimi
```

Options:

```bash
# Debug mode (show detailed logs)
hakimi --debug

# Custom working directory (default: ~/.hakimi/workspace)
hakimi --workdir /path/to/project
hakimi -w /path/to/project
```

### 1. Login to Kimi Code

Press `L` to login to your Kimi Code account. Follow the prompts to complete authorization in your browser.

### 2. Configure Bot Accounts

After login, chat with the AI assistant to configure your bot accounts. Just tell it what platform you want to set up (Telegram/Slack/Feishu), and it will guide you through the process.

The bot service starts automatically once configured.

## Supported Platforms

### Telegram

1. Search for @BotFather on Telegram
2. Send `/newbot` to create a bot
3. Get the Bot Token

### Slack

1. Go to https://api.slack.com/apps to create an app
2. Get the App-Level Token (`xapp-...`)
3. Get the Bot User OAuth Token (`xoxb-...`)

### Feishu (Lark)

1. Go to https://open.feishu.cn to create an app
2. Get the App ID and App Secret

## Hotkeys

| Key | Function |
|-----|----------|
| L | Login to Kimi Code (when not logged in) |
| Esc | Quit |

## Config Files

- Kimi Code: `~/.kimi/config.toml`
- Hakimi: `~/.hakimi/config.toml`
- Working directory: `~/.hakimi/workspace/` (default)

## License

MIT

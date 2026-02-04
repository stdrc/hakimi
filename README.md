# Hakimi

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

Debug mode (show detailed logs):

```bash
hakimi --debug
```

### 1. Login to Kimi Code

Press `L` to login to your Kimi Code account. Follow the prompts to complete authorization in your browser.

### 2. Configure

Press `C` to start the configuration wizard. The AI assistant will guide you through:
- Naming your AI assistant
- Setting up chat platforms (Telegram/Slack/Feishu)

### 3. Start Service

Press `S` to start the service, then send messages to your Bot on the chat platform.

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
| L | Login to Kimi Code |
| C | Configuration wizard |
| S | Start/Stop service |
| Q | Quit |
| Esc | Back/Cancel |

## Config Files

- Kimi Code: `~/.kimi/config.toml`
- Hakimi: `~/.hakimi/config.toml`

## License

MIT

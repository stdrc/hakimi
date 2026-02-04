# Hakimi

Hakimi lets you chat with an AI assistant via Telegram/Slack/Feishu to remotely control your computer.

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Run

```bash
npm run dev
```

Debug mode (show detailed logs):

```bash
npm run dev -- --debug
```

### 3. Login to Kimi Code

Press `L` to login to your Kimi Code account. Follow the prompts to complete authorization in your browser.

### 4. Configure

Press `C` to start the configuration wizard. The AI assistant will guide you through:
- Naming your AI assistant
- Setting up chat platforms (Telegram/Slack/Feishu)

### 5. Start Using

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

## Config File Locations

- Kimi Code: `~/.kimi/config.toml`
- Hakimi: `~/.hakimi/config.toml`

## Hotkeys

| Key | Function |
|-----|----------|
| L | Login to Kimi Code |
| C | Configuration wizard |
| S | Start/Stop service |
| Q | Quit |
| Esc | Back/Cancel |

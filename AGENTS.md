# Hakimi

Hakimi is a TUI application combining Kimi Agent SDK, Ink framework, and Koishi chatbot framework to:

1. Login to Kimi account
2. AI-assisted configuration of Koishi adapters (Telegram/Slack/Feishu)
3. Route chat platform messages to Kimi CLI

## Tech Stack

- **Runtime**: Node.js
- **UI Framework**: Ink (React for CLI)
- **AI SDK**: @moonshot-ai/kimi-agent-sdk
- **Chat Framework**: Koishi
- **Config Format**: TOML
- **Validation**: Zod

## Project Structure

```
hakimi/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx                 # Entry point
│   ├── App.tsx                   # Main app with screen routing
│   ├── components/
│   │   ├── StatusBar.tsx         # Login/adapter status
│   │   ├── HotkeyHint.tsx        # Hotkey hints
│   │   └── MessageLog.tsx        # Chat message display
│   ├── screens/
│   │   ├── HomeScreen.tsx        # Main menu (L, C, S, Q)
│   │   ├── LoginScreen.tsx       # OAuth login flow
│   │   └── ConfigScreen.tsx      # Config wizard
│   ├── services/
│   │   ├── loginService.ts       # kimi login --json parsing
│   │   ├── configAgent.ts        # Config agent with tools
│   │   ├── chatRouter.ts         # Koishi message routing
│   │   └── sessionCache.ts       # 5-min TTL session cache
│   ├── tools/
│   │   ├── askUser.ts            # AskUser tool
│   │   ├── finishConfig.ts       # FinishConfig tool
│   │   └── sendMessage.ts        # SendMessage tool
│   └── utils/
│       ├── paths.ts              # Path constants
│       └── config.ts             # TOML read/write
└── prompts/
    └── config-agent.md           # Config wizard prompt
```

## Config File Locations

- Kimi config: `~/.kimi/config.toml` (check `default_model` field for login status)
- Hakimi config: `~/.hakimi/config.toml`

## Development Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Run built output
npm start
```

## Screens & Hotkeys

### HomeScreen
- `L` - Login to Kimi
- `C` - Configure adapters (requires login)
- `S` - Start/Stop chat routing (requires adapters)
- `Q` - Quit

### LoginScreen
- Displays verification URL and user code
- `Esc` - Cancel

### ConfigScreen
- Chat with AI to configure adapters
- `Esc` - Cancel/Done

## Supported Adapters

### Telegram
```toml
[[adapters]]
type = "telegram"
[adapters.config]
protocol = "polling"  # or "server" for webhook
token = "BOT_TOKEN"   # From @BotFather
```

### Slack
```toml
[[adapters]]
type = "slack"
[adapters.config]
token = "xapp-..."      # App-level token
botToken = "xoxb-..."   # Bot user OAuth token
signing = "..."         # Optional, Signing secret
```

### Feishu (Lark)
```toml
[[adapters]]
type = "feishu"
[adapters.config]
appId = "..."
appSecret = "..."
```

## Agent Tools

### AskUser
Ask user for input (text).

### FinishConfig
Save adapter configuration to `~/.hakimi/config.toml`.

### SendMessage
Send message to chat user. Agent MUST use this tool to reply, not put replies in assistant message content.

## Session Management

- Session ID format: `{platform}-{botId}-{userId}`
- Sessions cached for 5 minutes, auto-cleanup on timeout
- New message while processing: interrupt current turn and restart

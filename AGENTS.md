# Hakimi

Hakimi is a TUI (Terminal User Interface) application that bridges instant messaging platforms (Telegram/Slack/Feishu) with Kimi Code CLI, enabling users to chat with an AI assistant via messaging apps to remotely control their computer.

## Project Overview

- **Package Name**: `hakimi`
- **Entry Point**: `src/index.tsx` (executable: `dist/index.js`)
- **Repository**: https://github.com/stdrc/hakimi
- **License**: MIT

### Core Features

1. **Kimi Login**: OAuth-based login to Kimi Code account via `kimi login --json`
2. **Terminal Chat**: Built-in chat interface for direct interaction with the AI
3. **Chat Routing**: Routes messages from IM platforms to Kimi Code CLI agent sessions
4. **Multi-Platform Support**: Telegram, Slack, and Feishu (Lark)
5. **Self-Configuration**: The AI can configure bot accounts through chat

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Language | TypeScript (ES2022, ESM) |
| UI Framework | Ink (React for CLI) |
| AI SDK | @moonshot-ai/kimi-agent-sdk |
| Chat Framework | Koishi |
| Config Format | TOML (@iarna/toml) |
| Validation | Zod |

## Project Structure

```
hakimi/
├── package.json              # Package config, scripts, dependencies
├── tsconfig.json             # TypeScript configuration
├── patches/                  # patch-package patches for dependencies
│   ├── @koishijs+loader+4.6.10.patch
│   ├── @moonshot-ai+kimi-agent-sdk+0.0.6.patch
│   └── @satorijs+core+4.5.2.patch
├── src/
│   ├── index.tsx             # Entry point with CLI arg parsing
│   ├── App.tsx               # Main app, screen routing, ChatRouter
│   ├── components/
│   │   └── StatusBar.tsx     # Login/bot status display
│   ├── screens/
│   │   ├── HomeScreen.tsx    # Main chat interface with status
│   │   └── LoginScreen.tsx   # OAuth login flow UI
│   ├── services/
│   │   ├── loginService.ts   # Spawns `kimi login --json`, parses events
│   │   ├── theAgent.ts       # TheAgent class for all chat sessions
│   │   ├── chatRouter.ts     # ChatRouter: Koishi setup, message handling
│   │   └── sessionCache.ts   # Generic TTL cache for chat sessions
│   └── utils/
│       ├── paths.ts          # Path constants, language detection
│       └── config.ts         # TOML config read/write helpers
└── dist/                     # TypeScript build output
```

## Build & Development Commands

```bash
# Install dependencies (runs postinstall to apply patches)
npm install

# Development mode with hot reload (tsx)
npm run dev

# Build TypeScript to dist/
npm run build

# Run the built application
npm start

# Run with debug logging
npm start -- --debug

# Run with custom working directory
npm start -- --workdir /path/to/project
# or with short flag
npm start -- -w /path/to/project
```

## Code Style Guidelines

- **TypeScript**: Strict mode enabled, ES2022 target
- **Module System**: ES Modules (`"type": "module"` in package.json)
- **JSX**: React JSX transform (`"jsx": "react-jsx"`)
- **Imports**: Use `.js` extension for local imports (TypeScript ESM requirement)
- **Types**: Prefer interfaces over type aliases; export types explicitly
- **Naming**: PascalCase for components/classes, camelCase for functions/variables
- **File Extensions**: `.tsx` for React components, `.ts` for pure TypeScript

### Code Patterns

```typescript
// Component with props interface
interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
}

export function MyComponent({ value, onChange }: MyComponentProps) {
  // ...
}

// Service class with callbacks
interface ServiceCallbacks {
  onEvent: (data: EventData) => void;
  onError: (error: Error) => void;
}

export class MyService {
  constructor(callbacks: ServiceCallbacks) {
    // ...
  }
}

// Tool definition with Zod schema
export const myToolSchema = z.object({
  param: z.string().describe('Parameter description'),
});
```

## Configuration Files

### Kimi Config (`~/.kimi/config.toml`)

Managed by Kimi Code CLI. Login status is checked via `default_model` field existence.

### Hakimi Config (`~/.hakimi/config.toml`)

```toml
agentName = "MyAssistant"

[[botAccounts]]
type = "telegram"
[botAccounts.config]
protocol = "polling"
token = "BOT_TOKEN"

[[botAccounts]]
type = "slack"
[botAccounts.config]
protocol = "ws"
token = "xapp-..."
botToken = "xoxb-..."

[[botAccounts]]
type = "feishu"
[botAccounts.config]
protocol = "ws"
appId = "..."
appSecret = "..."
```

## Key Architectural Concepts

### Screen Routing

The app uses a simple state-based screen routing in `App.tsx`:
- `home`: Main chat interface with status bar
- `login`: OAuth login flow

### ChatRouter

`ChatRouter` in `src/services/chatRouter.ts` is the core IM message routing service:
1. Loads bot account configurations from Hakimi config
2. Initializes Koishi context with bot adapters
3. Listens for incoming messages from IM platforms
4. Creates/retrieves `TheAgent` instances for each chat session
5. Handles message queuing when agent is processing

**Auto-start behavior:**
- On startup, if bot accounts are configured, chat service starts automatically
- After configuration changes, chat service automatically restarts with new config
- Errors during startup are caught and displayed in the status bar (won't crash the app)

### Session Management

- **Session ID Format**: `{platform}-{botId}-{userId}` for IM, `terminal` for local
- **TTL**: 5 minutes of inactivity (IM sessions only)
- **Behavior**: Sessions are cached and reused; new messages during processing are queued

### TheAgent

`TheAgent` in `src/services/theAgent.ts` handles all chat sessions (both terminal and IM):

**Tools:**
- `SendMessage`: Send a message to the user (required for all responses)
- `ReadHakimiConfig`: Read current Hakimi configuration
- `WriteHakimiConfig`: Write Hakimi configuration (triggers bot reload)

**Features:**
- Uses dynamic YAML agent file for customization
- Agent MUST use `SendMessage` tool to reply (assistant content is ignored)
- Configuration knowledge is embedded in the system prompt

### Patches

The project patches dependencies via `patch-package`:

1. **@koishijs/loader**: Fixes ESM default export issue
2. **@moonshot-ai/kimi-agent-sdk**: Adds `agentFile` option to customize agent behavior
3. **@satorijs/core**: Fixes bot dispose error when `ctx.bots` is undefined

## Hotkeys

| Screen | Key | Action |
|--------|-----|--------|
| Home (not logged in) | `L` | Login to Kimi Code |
| Home | `Esc` | Quit |
| Login | `Esc` | Cancel |

## Testing

No automated tests are currently implemented. Manual testing workflow:

1. Run `npm run dev` to start in development mode
2. Press `L` to login if not logged in
3. Chat with the AI in the terminal
4. Ask the AI to configure bot accounts (e.g., "Help me set up a Telegram bot")
5. Send messages via configured chat platforms

## Security Considerations

- Bot tokens and secrets are stored in plain text in `~/.hakimi/config.toml`
- Default working directory is `~/.hakimi/workspace` (not home directory)
- Only private messages are processed; group messages are ignored
- No authentication layer between chat platform and Kimi CLI

## Debugging

### Command Line Options

```bash
$ hakimi --help

  Options
    --workdir, -w  Working directory for the agent (default: ~/.hakimi/workspace)
    --debug        Enable debug logging
    --help         Show this help message
    --version      Show version number
```

Run with `--debug` flag to see detailed logs:

```bash
npm start -- --debug
```

Debug mode shows:
- Koishi bot status updates
- Message routing events
- Agent creation and message processing
- Send/receive logs

## Dependencies Overview

### Production Dependencies

- `ink`, `ink-spinner`, `ink-text-input`: TUI framework
- `react`: UI component library
- `koishi`: Chat bot framework
- `@koishijs/plugin-adapter-*`: Platform bot adapters
- `@moonshot-ai/kimi-agent-sdk`: Kimi AI agent SDK
- `@iarna/toml`: TOML parser/serializer
- `meow`: CLI argument parsing
- `zod`: Schema validation

### Dev Dependencies

- `typescript`: TypeScript compiler
- `tsx`: TypeScript execution (dev mode)
- `patch-package`: Dependency patching
- `@types/*`: Type definitions

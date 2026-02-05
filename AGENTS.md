# Hakimi

Hakimi is a TUI (Terminal User Interface) application that bridges instant messaging platforms (Telegram/Slack/Feishu) with Kimi Code CLI, enabling users to chat with an AI assistant via messaging apps to remotely control their computer.

## Project Overview

- **Package Name**: `hakimi`
- **Entry Point**: `src/index.tsx` (executable: `dist/index.js`)
- **Repository**: https://github.com/stdrc/hakimi
- **License**: MIT

### Core Features

1. **Kimi Login**: OAuth-based login to Kimi Code account via `kimi login --json`
2. **AI-Guided Configuration**: Interactive wizard to configure chat platform adapters
3. **Chat Routing**: Routes messages from chat platforms to Kimi Code CLI agent sessions
4. **Multi-Platform Support**: Telegram, Slack, and Feishu (Lark)

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
│   └── @moonshot-ai+kimi-agent-sdk+0.0.6.patch
├── prompts/
│   └── config-agent.md       # System prompt for config wizard AI
├── src/
│   ├── index.tsx             # Entry point with error handlers
│   ├── App.tsx               # Main app, screen routing, ChatRouter
│   ├── components/           # Reusable UI components
│   │   ├── StatusBar.tsx     # Login/adapter/chat status display
│   │   └── HotkeyHint.tsx    # Hotkey hints bar
│   ├── screens/              # Screen components (pages)
│   │   ├── HomeScreen.tsx    # Main menu (L, C, S, Q hotkeys)
│   │   ├── LoginScreen.tsx   # OAuth login flow UI
│   │   └── ConfigScreen.tsx  # Config wizard chat UI
│   ├── services/             # Business logic
│   │   ├── loginService.ts   # Spawns `kimi login --json`, parses events
│   │   ├── configAgent.ts    # ConfigAgent class for config wizard
│   │   ├── theAgent.ts       # TheAgent class for chat sessions
│   │   ├── chatRouter.ts     # ChatRouter: Koishi setup, message handling
│   │   └── sessionCache.ts   # Generic TTL cache for chat sessions
│   ├── tools/                # Agent tool definitions (Zod schemas)
│   │   ├── askUser.ts        # AskUser tool schema
│   │   └── sendMessage.ts    # SendMessage tool schema
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
# or in dev mode
npm run dev -- --debug

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

[[adapters]]
type = "telegram"
[adapters.config]
protocol = "polling"
token = "BOT_TOKEN"

[[adapters]]
type = "slack"
[adapters.config]
protocol = "ws"
token = "xapp-..."
botToken = "xoxb-..."

[[adapters]]
type = "feishu"
[adapters.config]
protocol = "ws"
appId = "..."
appSecret = "..."
```

## Key Architectural Concepts

### Screen Routing

The app uses a simple state-based screen routing in `App.tsx`:
- `home`: Main menu with status and hotkeys
- `login`: OAuth login flow
- `config`: AI-guided configuration wizard

### ChatRouter

`ChatRouter` in `src/services/chatRouter.ts` is the core message routing service:
1. Loads adapter configurations from Hakimi config
2. Initializes Koishi context with appropriate bot adapters
3. Listens for incoming messages
4. Creates/retrieves `TheAgent` instances for each chat session
5. Handles message queuing when agent is processing

**Auto-start behavior:**
- On startup, if adapters are configured, chat service starts automatically
- After configuration changes (via `C`), chat service automatically restarts with new config
- Errors during startup are caught and displayed in the status bar (won't crash the app)

### Session Management

- **Session ID Format**: `{platform}-{botId}-{userId}`
- **TTL**: 5 minutes of inactivity
- **Behavior**: Sessions are cached and reused; new messages during processing are queued

### Agent Architecture

Two agent types are used:

1. **ConfigAgent** (`configAgent.ts`): Guides users through adapter configuration
   - Tools: `AskUser`, `ReadConfig`, `WriteConfig`
   - The agent reads/writes config directly; user can exit anytime with Esc
   - Prompt: `prompts/config-agent.md`

2. **TheAgent** (`theAgent.ts`): Handles chat messages from platforms
   - Tools: `SendMessage`
   - Uses dynamic YAML agent file for customization
   - Agent MUST use `SendMessage` tool to reply (assistant content is ignored)

### Patches

The project patches two dependencies via `patch-package`:

1. **@koishijs/loader**: Fixes ESM default export issue
2. **@moonshot-ai/kimi-agent-sdk**: Adds `agentFile` option to customize agent behavior

## Hotkeys

| Screen | Key | Action |
|--------|-----|--------|
| Home | `L` | Login to Kimi |
| Home | `C` | Configure adapters (requires login) |
| Home | `S` | Start/Stop chat service (auto-starts if configured) |
| Home | `Q` | Quit |
| Login/Config | `Esc` | Cancel/Back |

## Testing

No automated tests are currently implemented. Manual testing workflow:

1. Run `npm run dev` to start in development mode
2. Press `L` to test login flow
3. Press `C` to test configuration wizard
4. Press `S` to start chat service
5. Send messages via configured chat platform

## Security Considerations

- Bot tokens and secrets are stored in plain text in `~/.hakimi/config.toml`
- The application has access to user's home directory via Kimi Code CLI
- Only private messages are processed; group messages are ignored
- No authentication layer between chat platform and Kimi CLI

## Debugging

### Command Line Options

```bash
$ hakimi --help

  Options
    --workdir, -w  Working directory for the agent (default: home directory)
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
- `@koishijs/plugin-adapter-*`: Platform adapters
- `@moonshot-ai/kimi-agent-sdk`: Kimi AI agent SDK
- `@iarna/toml`: TOML parser/serializer
- `meow`: CLI argument parsing
- `zod`: Schema validation

### Dev Dependencies

- `typescript`: TypeScript compiler
- `tsx`: TypeScript execution (dev mode)
- `patch-package`: Dependency patching
- `@types/*`: Type definitions

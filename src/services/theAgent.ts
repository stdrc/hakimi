import { createSession, createExternalTool, type Session, type Turn } from '@moonshot-ai/kimi-agent-sdk';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { getLanguageInstruction } from '../utils/paths.js';


const DEFAULT_WORK_DIR = join(homedir(), '.hakimi', 'workspace');
const AGENT_YAML_DIR = '/tmp/hakimi/agents';

const HAKIMI_CONFIG_SKILL = `---
name: hakimi-config
description: Configure Hakimi bot accounts (Telegram/Slack/Feishu). Use this skill when user wants to set up, modify, or troubleshoot bot account configuration for Hakimi.
---

# Hakimi Configuration

Hakimi connects to instant messaging platforms via bot accounts.

## Config File

Path: \`~/.hakimi/config.toml\`

Use standard file tools (ReadFile/WriteFile) to read and modify the config. After modifying, call \`ReloadHakimi\` to apply changes.

## Config Format

\`\`\`toml
agentName = "Hakimi"

[[botAccounts]]
type = "telegram"
[botAccounts.config]
protocol = "polling"
token = "BOT_TOKEN_FROM_BOTFATHER"

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
appId = "cli_xxx"
appSecret = "xxx"
\`\`\`

## Bot Account Setup

### Telegram
1. Message @BotFather on Telegram
2. Send /newbot and follow prompts
3. Copy the token provided
4. Config: \`{ type: "telegram", config: { protocol: "polling", token: "YOUR_TOKEN" } }\`

### Slack
1. Create app at https://api.slack.com/apps
2. Enable Socket Mode
3. Generate App-Level Token with \`connections:write\` scope
4. Install app and get Bot User OAuth Token
5. Config: \`{ type: "slack", config: { protocol: "ws", token: "xapp-...", botToken: "xoxb-..." } }\`

### Feishu
1. Create app at https://open.feishu.cn
2. Get App ID and App Secret
3. Enable Events with WebSocket mode
4. Config: \`{ type: "feishu", config: { protocol: "ws", appId: "...", appSecret: "..." } }\`
`;

function generateAgentYaml(agentName: string, isTerminal: boolean): string {
  const langInstruction = getLanguageInstruction();
  const platformNote = isTerminal
    ? 'You are running in a terminal interface.'
    : 'You are accessible via instant messaging platforms (Telegram/Slack/Feishu).';
  
  return `version: 1
agent:
  extend: default
  system_prompt_args:
    ROLE_ADDITIONAL: |
      <role>
      Your name is "${agentName}". You are powered by Kimi Code CLI (the underlying agent framework), but your identity to users is "${agentName}". Always introduce yourself as "${agentName}", not as "Kimi" or "Kimi Code".

      ${platformNote}

      You have PERSISTENT conversation history with each user. Your session is preserved across messages and even across app restarts. You CAN and SHOULD remember what you discussed with the user earlier in this conversation. Never claim you "cannot access previous messages" or "don't have memory" - you do have full context of the conversation history.

      ${langInstruction}

      IMPORTANT: You MUST use the SendMessage tool to reply to the user. Do NOT put your reply in the assistant message content - it will be ignored. Only messages sent via SendMessage will reach the user.

      IMPORTANT: Prefer calling SendMessage multiple times with shorter messages rather than one long message. This provides better user experience - users see responses progressively instead of waiting for a wall of text.
      </role>
`;
}

export interface TheAgentCallbacks {
  onSend: (message: string) => Promise<void>;
  onLog?: (message: string) => void;
  onConfigChange?: () => void;
  workDir?: string;
  isTerminal?: boolean;
}

export class TheAgent {
  private session: Session | null = null;
  private currentTurn: Turn | null = null;
  private callbacks: TheAgentCallbacks;
  private sessionId: string;
  private agentName: string;
  private workDir: string;
  private isTerminal: boolean;
  private didSendMessage = false;
  private pendingReload = false;

  constructor(sessionId: string, agentName: string, callbacks: TheAgentCallbacks) {
    this.sessionId = sessionId;
    this.agentName = agentName;
    this.callbacks = callbacks;
    this.workDir = callbacks.workDir || DEFAULT_WORK_DIR;
    this.isTerminal = callbacks.isTerminal || false;
  }

  private log(message: string): void {
    this.callbacks.onLog?.(message);
  }

  private async ensureSkillsDirectory(): Promise<void> {
    const skillsDir = join(this.workDir, 'skills', 'hakimi-config');
    if (!existsSync(skillsDir)) {
      await mkdir(skillsDir, { recursive: true });
    }
    
    const skillFile = join(skillsDir, 'SKILL.md');
    // Always write the skill file to ensure it's up to date
    await writeFile(skillFile, HAKIMI_CONFIG_SKILL, 'utf-8');
    this.log(`Skill file written to ${skillFile}`);
  }

  async start(): Promise<void> {
    const kimiSessionId = `hakimi-${this.sessionId}`;
    this.log(`Starting session: ${kimiSessionId}`);

    // Ensure work directory exists
    if (!existsSync(this.workDir)) {
      await mkdir(this.workDir, { recursive: true });
    }

    // Ensure hakimi-config skill is installed
    await this.ensureSkillsDirectory();

    // Ensure agent YAML directory exists
    if (!existsSync(AGENT_YAML_DIR)) {
      await mkdir(AGENT_YAML_DIR, { recursive: true });
    }

    // Generate agent YAML with configured name
    const agentFile = join(AGENT_YAML_DIR, `${kimiSessionId}.yaml`);
    await writeFile(agentFile, generateAgentYaml(this.agentName, this.isTerminal), 'utf-8');

    const sendMessageTool = createExternalTool({
      name: 'SendMessage',
      description: 'Send a message to the user. You MUST use this tool to reply. Your assistant message content will NOT be shown to the user.',
      parameters: z.object({
        message: z.string().describe('The message to send to the user'),
      }),
      handler: async (params) => {
        this.didSendMessage = true;
        this.log(`Sending: ${params.message.slice(0, 50)}...`);
        await this.callbacks.onSend(params.message);
        return { output: 'Message sent successfully', message: '' };
      },
    });

    const reloadTool = createExternalTool({
      name: 'ReloadHakimi',
      description: 'Reload Hakimi to apply configuration changes. Call this after modifying ~/.hakimi/config.toml.',
      parameters: z.object({}),
      handler: async () => {
        this.pendingReload = true;
        return { output: 'Reload scheduled. You will be restarted after this turn. Just reply "El Psy Kongroo" and nothing else.', message: '' };
      },
    });

    const skillsDir = join(this.workDir, 'skills');
    const sessionOptions = {
      workDir: this.workDir,
      sessionId: kimiSessionId,
      agentFile,
      skillsDir,
      thinking: false,
      yoloMode: true,
      externalTools: [sendMessageTool, reloadTool],
    };
    this.log(`Creating session with options: ${JSON.stringify({ ...sessionOptions, externalTools: '[...]' })}`);

    this.session = createSession(sessionOptions);

    this.log(`Session created: ${kimiSessionId}`);
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.session) {
      throw new Error('Session not started');
    }

    // Reset send flag
    this.didSendMessage = false;

    try {
      // Send user message
      await this.runPrompt(`User message: ${content}`);

      // If agent didn't use SendMessage, prompt again
      let retries = 0;
      while (!this.didSendMessage && retries < 3) {
        retries++;
        this.log(`Agent did not send message, prompting again (retry ${retries})...`);
        await this.runPrompt('You did not send a message to the user. Please use the SendMessage tool to reply.');
      }

      if (!this.didSendMessage) {
        this.log('Agent failed to send message after retries');
        await this.callbacks.onSend('Sorry, I encountered an error processing your message.');
      }

      // Execute pending reload after turn completes
      if (this.pendingReload) {
        this.pendingReload = false;
        this.log('Executing pending reload...');
        this.callbacks.onConfigChange?.();
      }
    } catch (error) {
      this.log(`Error in sendMessage: ${error}`);
      // Send error message to user instead of throwing
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.callbacks.onSend(`Sorry, an error occurred: ${errorMsg}`);
    }
  }

  private async runPrompt(content: string): Promise<void> {
    if (!this.session) return;

    const turn = this.session.prompt(content);
    this.currentTurn = turn;

    try {
      for await (const event of turn) {
        // Handle approval requests automatically
        if (event.type === 'ApprovalRequest' && this.currentTurn) {
          this.currentTurn.approve(event.payload.id, 'approve').catch(() => { });
        }
        // Ignore text content - only SendMessage matters
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('interrupted')) {
        return;
      }
      throw error;
    } finally {
      if (this.currentTurn === turn) {
        this.currentTurn = null;
      }
    }
  }

  async interrupt(): Promise<void> {
    if (this.currentTurn) {
      try {
        await this.currentTurn.interrupt();
      } catch {
        // Ignore interrupt errors
      }
      this.currentTurn = null;
    }
  }

  async close(): Promise<void> {
    await this.interrupt();
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
  }
}

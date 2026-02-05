import { createSession, createExternalTool, type Session, type Turn } from '@moonshot-ai/kimi-agent-sdk';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { getLanguageInstruction } from '../utils/paths.js';

const HOME_DIR = homedir();
const AGENT_YAML_DIR = '/tmp/hakimi/agents';

function generateAgentYaml(agentName: string): string {
  const langInstruction = getLanguageInstruction();
  return `version: 1
agent:
  extend: default
  system_prompt_args:
    ROLE_ADDITIONAL: |
      <role>
      Your name is "${agentName}". You are powered by Kimi Code CLI (the underlying agent framework), but your identity to users is "${agentName}". Always introduce yourself as "${agentName}", not as "Kimi" or "Kimi Code".

      You are accessible via instant messaging platforms (Telegram/Slack/Feishu).

      You have PERSISTENT conversation history with each user. Your session is preserved across messages and even across app restarts. You CAN and SHOULD remember what you discussed with the user earlier in this conversation. Never claim you "cannot access previous messages" or "don't have memory" - you do have full context of the conversation history.

      ${langInstruction}

      IMPORTANT: You MUST use the SendMessage tool to reply to the user. Do NOT put your reply in the assistant message content - it will be ignored. Only messages sent via SendMessage will reach the user.

      IMPORTANT: Prefer calling SendMessage multiple times with shorter messages rather than one long message. This provides better user experience on IM platforms - users see responses progressively instead of waiting for a wall of text. For example:
      - Send a greeting first, then details
      - Send each major point separately
      - Send code blocks as separate messages
      </role>
`;
}

export interface TheAgentCallbacks {
  onSend: (message: string) => Promise<void>;
  onLog?: (message: string) => void;
  workDir?: string;
}

export class TheAgent {
  private session: Session | null = null;
  private currentTurn: Turn | null = null;
  private callbacks: TheAgentCallbacks;
  private sessionId: string;
  private agentName: string;
  private workDir: string;
  private didSendMessage = false;

  constructor(sessionId: string, agentName: string, callbacks: TheAgentCallbacks) {
    this.sessionId = sessionId;
    this.agentName = agentName;
    this.callbacks = callbacks;
    this.workDir = callbacks.workDir || HOME_DIR;
  }

  private log(message: string): void {
    this.callbacks.onLog?.(message);
  }

  async start(): Promise<void> {
    const kimiSessionId = `hakimi-${this.sessionId}`;
    this.log(`Starting session: ${kimiSessionId}`);

    // Ensure agent YAML directory exists
    if (!existsSync(AGENT_YAML_DIR)) {
      await mkdir(AGENT_YAML_DIR, { recursive: true });
    }

    // Generate agent YAML with configured name
    const agentFile = join(AGENT_YAML_DIR, `${kimiSessionId}.yaml`);
    await writeFile(agentFile, generateAgentYaml(this.agentName), 'utf-8');

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

    const sessionOptions = {
      workDir: this.workDir,
      sessionId: kimiSessionId,
      agentFile,
      thinking: false,
      yoloMode: true,
      externalTools: [sendMessageTool],
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

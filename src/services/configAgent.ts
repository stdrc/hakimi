import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, createExternalTool, type Session, type Turn, type StreamEvent } from '@moonshot-ai/kimi-agent-sdk';
import { z } from 'zod';
import { writeHakimiConfig, type AdapterConfig } from '../utils/config.js';
import { HAKIMI_DIR } from '../utils/paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFIG_SESSION_ID = 'hakimi-config-wizard';

export interface ConfigAgentCallbacks {
  onText: (text: string) => void;
  onAskUser: (question: string) => Promise<string>;
  onFinished: () => void;
  onError: (error: Error) => void;
}

export async function loadConfigPrompt(): Promise<string> {
  const promptPath = join(__dirname, '../../prompts/config-agent.md');
  return readFile(promptPath, 'utf-8');
}

export class ConfigAgent {
  private session: Session | null = null;
  private currentTurn: Turn | null = null;
  private callbacks: ConfigAgentCallbacks;
  private systemPrompt: string = '';

  constructor(callbacks: ConfigAgentCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.systemPrompt = await loadConfigPrompt();

    // Ensure work directory exists
    if (!existsSync(HAKIMI_DIR)) {
      await mkdir(HAKIMI_DIR, { recursive: true });
    }

    const askUserTool = createExternalTool({
      name: 'AskUser',
      description: 'Ask user for input like API tokens or configuration values',
      parameters: z.object({
        question: z.string().describe('The question to ask the user'),
      }),
      handler: async (params) => {
        const answer = await this.callbacks.onAskUser(params.question);
        return { output: answer, message: '' };
      },
    });

    const finishConfigTool = createExternalTool({
      name: 'FinishConfig',
      description: 'Save configuration and finish the wizard',
      parameters: z.object({
        agentName: z.string().optional().describe('Name for the AI assistant (default: Hakimi)'),
        adapters: z.array(z.object({
          type: z.enum(['telegram', 'slack', 'feishu']),
          config: z.record(z.any()),
        })).describe('List of adapter configurations to save'),
      }),
      handler: async (params) => {
        await writeHakimiConfig({
          agentName: params.agentName || 'Hakimi',
          adapters: params.adapters as AdapterConfig[],
        });
        this.callbacks.onFinished();
        return { output: `Saved configuration: agent "${params.agentName || 'Hakimi'}" with ${params.adapters.length} adapter(s)`, message: '' };
      },
    });

    this.session = createSession({
      workDir: HAKIMI_DIR,
      sessionId: CONFIG_SESSION_ID,
      thinking: false,
      yoloMode: true,
      externalTools: [askUserTool, finishConfigTool],
    });

    // Clear previous session context
    await this.sendMessage('/clear');

    // Send initial prompt with system instructions
    await this.sendMessage(this.systemPrompt + '\n\nPlease start by asking the user what they want to name their AI assistant.');
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.session) {
      throw new Error('Session not started');
    }

    const turn = this.session.prompt(content);
    this.currentTurn = turn;

    try {
      for await (const event of turn) {
        this.handleEvent(event);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('interrupted')) {
        return;
      }
      this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Clear turn reference after completion
      if (this.currentTurn === turn) {
        this.currentTurn = null;
      }
    }
  }

  private handleEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'ContentPart':
        if (event.payload.type === 'text') {
          this.callbacks.onText(event.payload.text);
        }
        break;
      case 'ApprovalRequest':
        // Auto-approve any pending requests
        if (this.currentTurn) {
          this.currentTurn.approve(event.payload.id, 'approve').catch(() => {});
        }
        break;
    }
  }

  async close(): Promise<void> {
    if (this.currentTurn) {
      try {
        await this.currentTurn.interrupt();
      } catch {
        // Ignore interrupt errors on close
      }
      this.currentTurn = null;
    }
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
  }
}

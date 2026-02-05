import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, createExternalTool, type Session, type Turn, type StreamEvent } from '@moonshot-ai/kimi-agent-sdk';
import { z } from 'zod';
import { readHakimiConfig, writeHakimiConfig, type HakimiConfig } from '../utils/config.js';
import { HAKIMI_DIR, HAKIMI_CONFIG, getLanguageInstruction } from '../utils/paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateSessionId(): string {
  return `hakimi-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

    const readConfigTool = createExternalTool({
      name: 'ReadConfig',
      description: `Read the current Hakimi configuration from ${HAKIMI_CONFIG}`,
      parameters: z.object({}),
      handler: async () => {
        const config = await readHakimiConfig();
        if (!config) {
          return { output: 'Config file does not exist yet', message: '' };
        }
        return { output: JSON.stringify(config, null, 2), message: '' };
      },
    });

    const writeConfigTool = createExternalTool({
      name: 'WriteConfig',
      description: `Write configuration to ${HAKIMI_CONFIG}`,
      parameters: z.object({
        config: z.object({
          agentName: z.string().optional().describe('Name for the AI assistant'),
          adapters: z.array(z.object({
            type: z.enum(['telegram', 'slack', 'feishu']),
            config: z.record(z.any()),
          })).optional().describe('List of adapter configurations'),
        }).describe('The configuration object to write'),
      }),
      handler: async (params) => {
        await writeHakimiConfig(params.config as HakimiConfig);
        return { output: 'Configuration saved successfully', message: '' };
      },
    });

    const finishTool = createExternalTool({
      name: 'Finish',
      description: 'Finish the configuration wizard',
      parameters: z.object({}),
      handler: async () => {
        this.callbacks.onFinished();
        return { output: 'Configuration wizard finished', message: '' };
      },
    });

    this.session = createSession({
      workDir: HAKIMI_DIR,
      sessionId: generateSessionId(),
      thinking: false,
      yoloMode: true,
      externalTools: [askUserTool, readConfigTool, writeConfigTool, finishTool],
    });

    // Send initial prompt with system instructions and current config
    const langInstruction = getLanguageInstruction();
    const currentConfig = await readHakimiConfig();
    const configInfo = currentConfig
      ? `Current config:\n\`\`\`json\n${JSON.stringify(currentConfig, null, 2)}\n\`\`\``
      : 'No existing config file.';
    await this.sendMessage(this.systemPrompt + `\n\n${langInstruction}\n\n${configInfo}\n\nGuide the user through configuration.`);
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

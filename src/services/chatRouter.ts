import { readHakimiConfig, type AdapterConfig } from '../utils/config.js';
import { SessionCache } from './sessionCache.js';
import { TheAgent } from './theAgent.js';

export interface ChatSession {
  sessionId: string;
  platform: string;
  userId: string;
  botId: string;
  isProcessing: boolean;
  sendFn: (message: string) => Promise<void>;
  agent: TheAgent | null;
  pendingMessage: string | null;
}

export interface ChatRouterOptions {
  onMessage: (sessionId: string, content: string) => void;
  onSessionStart: (session: ChatSession) => void;
  onSessionEnd: (sessionId: string) => void;
  onLog?: (message: string) => void;
}

// Dynamic import types
type KoishiContext = InstanceType<typeof import('koishi').Context>;
type KoishiSession = import('koishi').Session;

export class ChatRouter {
  private ctx: KoishiContext | null = null;
  private sessionCache: SessionCache<ChatSession>;
  private options: ChatRouterOptions;
  private isRunning = false;
  private agentName = 'Hakimi';
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: ChatRouterOptions) {
    this.options = options;
    this.sessionCache = new SessionCache<ChatSession>((sessionId) => {
      this.options.onSessionEnd(sessionId);
    });
  }

  private log(message: string): void {
    this.options.onLog?.(message);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendWithRetry(fn: () => Promise<unknown>, maxRetries: number): Promise<void> {
    let lastError: Error | null = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fn();
        return;
      } catch (error) {
        lastError = error as Error;
        const delay = Math.min(3000 * (i + 1), 30000); // 3s, 6s, 9s, ... up to 30s
        this.log(`Send failed (${i + 1}/${maxRetries}), retry in ${delay / 1000}s...`);
        await this.sleep(delay);
      }
    }
    this.log(`Send failed after ${maxRetries} retries: ${lastError?.message}`);
  }

  async start(): Promise<void> {
    const config = await readHakimiConfig();
    if (!config?.adapters || config.adapters.length === 0) {
      throw new Error('No adapters configured');
    }

    this.agentName = config.agentName || 'Hakimi';

    // Dynamic import koishi to avoid Node.js v24 compatibility issues at load time
    const { Context, HTTP } = await import('koishi');
    this.ctx = new Context();

    // Register HTTP service (required by bot adapters)
    this.ctx.plugin(HTTP);

    for (const adapter of config.adapters) {
      await this.loadAdapter(adapter);
    }

    // Listen for bot status updates
    this.ctx.on('bot-status-updated', (bot) => {
      this.log(`Bot ${bot.selfId || 'unknown'} status: ${bot.status}`);
      // Status 3 = offline, try to reconnect
      if (bot.status === 3) {
        this.scheduleReconnect(bot);
      }
    });

    // Listen for errors - don't crash, just log
    this.ctx.on('internal/error', (error) => {
      this.log(`Error: ${error.message || error}`);
    });

    this.ctx.on('message', (session: KoishiSession) => {
      this.log(`Message from ${session.userId}: ${session.content}`);
      this.handleMessage(session);
    });

    this.log('Starting Koishi context...');

    // Start with retry
    await this.startWithRetry();

    this.isRunning = true;
  }

  private async startWithRetry(maxRetries = Infinity): Promise<void> {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await this.ctx!.start();

        // Log created bots
        const bots = this.ctx!.bots || [];
        this.log(`Koishi started with ${bots.length} bot(s)`);
        for (const bot of bots) {
          this.log(`Bot: ${bot.platform}/${bot.selfId || 'connecting...'} - ${bot.status}`);
        }
        return;
      } catch (error) {
        retries++;
        const delay = Math.min(5000 * retries, 30000); // Max 30s delay
        this.log(`Start failed (${retries}), retrying in ${delay / 1000}s: ${error}`);
        await this.sleep(delay);
      }
    }
  }

  private scheduleReconnect(bot: any): void {
    const botKey = `${bot.platform}-${bot.selfId}`;

    // Clear existing retry timeout
    const existing = this.retryTimeouts.get(botKey);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule reconnect
    const timeout = setTimeout(async () => {
      this.retryTimeouts.delete(botKey);
      this.log(`Attempting to reconnect bot ${botKey}...`);
      try {
        await bot.start();
        this.log(`Bot ${botKey} reconnected`);
      } catch (error) {
        this.log(`Reconnect failed for ${botKey}: ${error}`);
        // Schedule another retry
        this.scheduleReconnect(bot);
      }
    }, 5000);

    this.retryTimeouts.set(botKey, timeout);
  }

  private async loadAdapter(adapter: AdapterConfig): Promise<void> {
    if (!this.ctx) return;

    this.log(`Loading ${adapter.type} adapter...`);

    switch (adapter.type) {
      case 'telegram': {
        const mod = await import('@koishijs/plugin-adapter-telegram');
        const TelegramBot = (mod as any).TelegramBot || mod.default;
        this.ctx.plugin(TelegramBot, adapter.config);
        this.log(`Telegram adapter loaded`);
        break;
      }
      case 'slack': {
        const mod = await import('@koishijs/plugin-adapter-slack');
        const SlackBot = (mod as any).SlackBot || mod.default;
        this.ctx.plugin(SlackBot, adapter.config);
        this.log(`Slack adapter loaded`);
        break;
      }
      case 'feishu': {
        const mod = await import('@koishijs/plugin-adapter-lark');
        const LarkBot = (mod as any).LarkBot || mod.default;
        this.ctx.plugin(LarkBot, adapter.config);
        this.log(`Feishu adapter loaded`);
        break;
      }
    }
  }

  private handleMessage(koishiSession: KoishiSession): void {
    this.log(`Received: platform=${koishiSession.platform}, guildId=${koishiSession.guildId}, channelId=${koishiSession.channelId}, userId=${koishiSession.userId}`);

    // Only handle private messages (no guildId, or Slack DM channels starting with 'D')
    const isPrivate = !koishiSession.guildId ||
      (koishiSession.platform === 'slack' && koishiSession.channelId?.startsWith('D'));

    if (!isPrivate) {
      this.log(`Skipping non-private message`);
      return;
    }

    const sessionId = `${koishiSession.platform}-${koishiSession.selfId}-${koishiSession.userId}`;
    const content = koishiSession.content || '';

    let chatSession = this.sessionCache.get(sessionId);

    if (!chatSession) {
      chatSession = {
        sessionId,
        platform: koishiSession.platform,
        userId: koishiSession.userId || '',
        botId: koishiSession.selfId || '',
        isProcessing: false,
        sendFn: async (message: string) => {
          await this.sendWithRetry(() => koishiSession.send(message), 10);
        },
        agent: null,
        pendingMessage: null,
      };
      this.sessionCache.set(sessionId, chatSession);
      this.options.onSessionStart(chatSession);
    }

    this.options.onMessage(sessionId, content);

    // Process message with agent
    this.processMessage(chatSession, content);
  }

  private async processMessage(session: ChatSession, content: string): Promise<void> {
    // If already processing, interrupt and queue the new message
    if (session.isProcessing) {
      this.log(`Interrupting current turn for ${session.sessionId}`);
      session.pendingMessage = content;
      if (session.agent) {
        await session.agent.interrupt();
      }
      return;
    }

    session.isProcessing = true;

    try {
      // Create agent if not exists
      if (!session.agent) {
        this.log(`Creating agent for ${session.sessionId}`);
        session.agent = new TheAgent(session.sessionId, this.agentName, {
          onSend: async (message) => {
            await session.sendFn(message);
          },
          onLog: (msg) => this.log(msg),
        });
        await session.agent.start();
      }

      // Process the message
      await session.agent.sendMessage(content);

      // Check for pending messages (new message came in while processing)
      while (session.pendingMessage) {
        const pending = session.pendingMessage;
        session.pendingMessage = null;
        this.log(`Processing pending message: ${pending}`);
        await session.agent.sendMessage(pending);
      }
    } catch (error) {
      this.log(`Error processing message: ${error}`);
    } finally {
      session.isProcessing = false;
    }
  }

  getSession(sessionId: string): ChatSession | undefined {
    return this.sessionCache.get(sessionId);
  }

  async stop(): Promise<void> {
    // Clear all retry timeouts
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();

    // Close all agents
    for (const session of this.sessionCache.values()) {
      if (session.agent) {
        await session.agent.close();
      }
    }
    this.sessionCache.clear();
    if (this.ctx) {
      try {
        await this.ctx.stop();
      } catch {
        // Ignore stop errors
      }
      this.ctx = null;
    }
    this.isRunning = false;
  }

  get running(): boolean {
    return this.isRunning;
  }

  get activeSessions(): number {
    return this.sessionCache.size;
  }
}

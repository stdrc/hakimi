import { readHakimiConfig, type BotAccountConfig } from '../utils/config.js';
import { SessionCache } from './sessionCache.js';
import { TheAgent, type MessageContext } from './theAgent.js';

export interface ChatSession {
  sessionId: string;
  platform: string;
  userId: string;
  botId: string;
  isProcessing: boolean;
  sendFn: (message: string) => Promise<void>;
  agent: TheAgent | null;
  pendingMessage: MessageContext | null;
}

export type BotStatus = 'connecting' | 'active' | 'inactive' | 'error';

export interface BotStatusInfo {
  type: string;
  platform: string;
  selfId?: string;
  name?: string;
  status: BotStatus;
  error?: string;
}

export interface ChatRouterOptions {
  onMessage: (sessionId: string, content: string) => void;
  onSessionStart: (session: ChatSession) => void;
  onSessionEnd: (sessionId: string) => void;
  onBotStatusChange?: (bots: BotStatusInfo[]) => void;
  onLog?: (message: string) => void;
  debug?: boolean;
  workDir?: string;
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
  private botConfigs: BotAccountConfig[] = [];
  private botStatuses: Map<string, BotStatusInfo> = new Map();

  constructor(options: ChatRouterOptions) {
    this.options = options;
    this.sessionCache = new SessionCache<ChatSession>((sessionId) => {
      this.options.onSessionEnd(sessionId);
    });

    // Suppress koishi/reggol logs unless debug mode
    if (!options.debug) {
      this.suppressKoishiLogs();
    }
  }

  private async suppressKoishiLogs(): Promise<void> {
    try {
      const reggol = await import('reggol');
      const Logger = reggol.default;
      Logger.levels.base = 0; // SILENT
    } catch {
      // Ignore if reggol is not available
    }
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
        const delay = Math.min(3000 * (i + 1), 30000);
        this.log(`Send failed (${i + 1}/${maxRetries}), retry in ${delay / 1000}s...`);
        await this.sleep(delay);
      }
    }
    this.log(`Send failed after ${maxRetries} retries: ${lastError?.message}`);
  }

  private updateBotStatus(key: string, info: BotStatusInfo): void {
    this.botStatuses.set(key, info);
    this.notifyBotStatusChange();
  }

  private notifyBotStatusChange(): void {
    const bots = Array.from(this.botStatuses.values());
    this.options.onBotStatusChange?.(bots);
  }

  async start(): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await readHakimiConfig();
      if (!config?.botAccounts || config.botAccounts.length === 0) {
        return { success: false, error: 'No bot accounts configured' };
      }

      this.agentName = config.agentName || 'Hakimi';
      this.botConfigs = config.botAccounts;
      this.botStatuses.clear();

      // Initialize bot statuses as connecting
      for (let i = 0; i < this.botConfigs.length; i++) {
        const botConfig = this.botConfigs[i];
        const key = `${botConfig.type}-${i}`;
        this.updateBotStatus(key, {
          type: botConfig.type,
          platform: botConfig.type === 'feishu' ? 'lark' : botConfig.type,
          status: 'connecting',
        });
      }

      // Dynamic import koishi
      const { Context, HTTP } = await import('koishi');
      this.ctx = new Context();
      this.ctx.plugin(HTTP);

      for (const botConfig of this.botConfigs) {
        await this.loadBotAccount(botConfig);
      }

      // Listen for bot status updates
      this.ctx.on('bot-status-updated', (bot) => {
        this.log(`Bot ${bot.platform}/${bot.selfId || 'unknown'} status: ${bot.status}`);
        this.handleKoishiBotStatus(bot);
      });

      // Listen for errors
      this.ctx.on('internal/error', (error) => {
        this.log(`Error: ${error.message || error}`);
      });

      this.ctx.on('message', (session: KoishiSession) => {
        this.log(`Message from ${session.userId}: ${session.content}`);
        this.handleMessage(session);
      });

      this.log('Starting Koishi context...');
      await this.startWithRetry(3);
      this.isRunning = true;
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Failed to start: ${errorMsg}`);
      
      // Mark all bots as error
      for (const [key, info] of this.botStatuses) {
        this.updateBotStatus(key, { ...info, status: 'error', error: errorMsg });
      }
      
      if (this.ctx) {
        try {
          await this.ctx.stop();
        } catch {
          // Ignore
        }
        this.ctx = null;
      }
      return { success: false, error: errorMsg };
    }
  }

  private handleKoishiBotStatus(bot: any): void {
    // Find matching bot config
    const key = this.findBotKey(bot.platform, bot.selfId);
    if (!key) return;

    const existing = this.botStatuses.get(key);
    if (!existing) return;

    // Koishi bot status: 0=offline, 1=online, 2=connect, 3=disconnect, 4=reconnect
    let status: BotStatus;
    switch (bot.status) {
      case 1: // online
        status = 'active';
        break;
      case 0: // offline
      case 3: // disconnect
        status = 'inactive';
        this.scheduleReconnect(bot);
        break;
      case 2: // connect
      case 4: // reconnect
        status = 'connecting';
        break;
      default:
        status = 'inactive';
    }

    // Get bot name from user object
    const name = bot.user?.name || bot.user?.nick;

    this.updateBotStatus(key, {
      ...existing,
      selfId: bot.selfId,
      name,
      status,
    });
  }

  private findBotKey(platform: string, selfId?: string): string | null {
    // Try to find by platform and selfId
    for (const [key, info] of this.botStatuses) {
      if (info.platform === platform && (info.selfId === selfId || !info.selfId)) {
        return key;
      }
    }
    return null;
  }

  async restart(): Promise<{ success: boolean; error?: string }> {
    this.log('Restarting chat router...');
    await this.stop();
    return this.start();
  }

  private async startWithRetry(maxRetries = 3): Promise<void> {
    let retries = 0;
    let lastError: Error | null = null;
    while (retries < maxRetries) {
      try {
        await this.ctx!.start();

        const bots = this.ctx!.bots || [];
        this.log(`Koishi started with ${bots.length} bot(s)`);
        for (const bot of bots) {
          this.log(`Bot: ${bot.platform}/${bot.selfId || 'connecting...'} - ${bot.status}`);
        }
        return;
      } catch (error) {
        lastError = error as Error;
        retries++;
        if (retries >= maxRetries) break;
        const delay = Math.min(5000 * retries, 30000);
        this.log(`Start failed (${retries}/${maxRetries}), retrying in ${delay / 1000}s: ${error}`);
        await this.sleep(delay);
      }
    }
    throw lastError || new Error('Failed to start after retries');
  }

  private scheduleReconnect(bot: any): void {
    const botKey = `${bot.platform}-${bot.selfId}`;

    const existing = this.retryTimeouts.get(botKey);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      this.retryTimeouts.delete(botKey);
      this.log(`Attempting to reconnect bot ${botKey}...`);
      try {
        await bot.start();
        this.log(`Bot ${botKey} reconnected`);
      } catch (error) {
        this.log(`Reconnect failed for ${botKey}: ${error}`);
        this.scheduleReconnect(bot);
      }
    }, 5000);

    this.retryTimeouts.set(botKey, timeout);
  }

  private async loadBotAccount(botConfig: BotAccountConfig): Promise<void> {
    if (!this.ctx) return;

    this.log(`Loading ${botConfig.type} bot...`);

    switch (botConfig.type) {
      case 'telegram': {
        const mod = await import('@koishijs/plugin-adapter-telegram');
        const TelegramBot = (mod as any).TelegramBot || mod.default;
        this.ctx.plugin(TelegramBot, botConfig.config);
        break;
      }
      case 'slack': {
        const mod = await import('@koishijs/plugin-adapter-slack');
        const SlackBot = (mod as any).SlackBot || mod.default;
        this.ctx.plugin(SlackBot, botConfig.config);
        break;
      }
      case 'feishu': {
        const mod = await import('@koishijs/plugin-adapter-lark');
        const LarkBot = (mod as any).LarkBot || mod.default;
        this.ctx.plugin(LarkBot, botConfig.config);
        break;
      }
    }
  }

  private handleMessage(koishiSession: KoishiSession): void {
    this.log(`Received: platform=${koishiSession.platform}, guildId=${koishiSession.guildId}, channelId=${koishiSession.channelId}, userId=${koishiSession.userId}`);

    const isPrivate = !koishiSession.guildId ||
      (koishiSession.platform === 'slack' && koishiSession.channelId?.startsWith('D')) ||
      (koishiSession.platform === 'lark' && koishiSession.guildId === koishiSession.channelId);

    if (!isPrivate) {
      this.log(`Skipping non-private message`);
      return;
    }

    const sessionId = `${koishiSession.platform}-${koishiSession.selfId}-${koishiSession.userId}`;
    const messageContext = this.extractMessageContext(koishiSession);

    let chatSession = this.sessionCache.get(sessionId);

    if (!chatSession) {
      const platform = koishiSession.platform;
      chatSession = {
        sessionId,
        platform,
        userId: koishiSession.userId || '',
        botId: koishiSession.selfId || '',
        isProcessing: false,
        sendFn: async (message: string) => {
          let escapedMessage = message;
          if (platform === 'slack') {
            escapedMessage = message
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          }
          await this.sendWithRetry(() => koishiSession.send(escapedMessage), 10);
        },
        agent: null,
        pendingMessage: null,
      };
      this.sessionCache.set(sessionId, chatSession);
      this.options.onSessionStart(chatSession);
    }

    this.options.onMessage(sessionId, messageContext.text);
    this.processMessage(chatSession, messageContext);
  }

  private extractMessageContext(koishiSession: KoishiSession): MessageContext {
    const images: string[] = [];
    const videos: string[] = [];
    
    // Extract media from elements
    const elements = (koishiSession as any).elements || [];
    for (const el of elements) {
      if (el.type === 'img' || el.type === 'image') {
        const src = el.attrs?.src || el.attrs?.url;
        if (src) {
          images.push(src);
        }
      } else if (el.type === 'video') {
        const src = el.attrs?.src || el.attrs?.url;
        if (src) {
          videos.push(src);
        }
      } else if (el.type === 'file') {
        // Treat file as video if it looks like one
        const src = el.attrs?.src || el.attrs?.url;
        const type = el.attrs?.type || '';
        if (src && type.startsWith('video/')) {
          videos.push(src);
        }
      }
    }

    // Get user info
    const user = (koishiSession as any).event?.user || (koishiSession as any).author || {};
    const userName = user.name || user.nick || user.username || user.nickname;

    return {
      userId: koishiSession.userId || '',
      userName,
      timestamp: (koishiSession as any).timestamp || Date.now(),
      text: koishiSession.content || '',
      images: images.length > 0 ? images : undefined,
      videos: videos.length > 0 ? videos : undefined,
    };
  }

  private async processMessage(session: ChatSession, context: MessageContext): Promise<void> {
    if (session.isProcessing) {
      this.log(`Interrupting current turn for ${session.sessionId}`);
      session.pendingMessage = context;
      if (session.agent) {
        await session.agent.interrupt();
      }
      return;
    }

    session.isProcessing = true;

    try {
      if (!session.agent) {
        this.log(`Creating agent for ${session.sessionId}`);
        session.agent = new TheAgent(session.sessionId, this.agentName, {
          onSend: async (message) => {
            await session.sendFn(message);
          },
          onLog: (msg) => this.log(msg),
          workDir: this.options.workDir,
        });
        await session.agent.start();
      }

      await session.agent.sendMessage(context);

      while (session.pendingMessage) {
        const pending = session.pendingMessage;
        session.pendingMessage = null;
        this.log(`Processing pending message: ${pending.text}`);
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

  getBotStatuses(): BotStatusInfo[] {
    return Array.from(this.botStatuses.values());
  }

  async stop(): Promise<void> {
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();

    for (const session of this.sessionCache.values()) {
      if (session.agent) {
        await session.agent.close();
      }
    }
    this.sessionCache.clear();
    
    // Mark all bots as inactive
    for (const [key, info] of this.botStatuses) {
      this.botStatuses.set(key, { ...info, status: 'inactive' });
    }
    this.notifyBotStatusChange();
    
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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { HomeScreen } from './screens/HomeScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { isLoggedIn as checkLoggedIn, readHakimiConfig } from './utils/config.js';
import { ChatRouter, type ChatSession, type BotStatusInfo } from './services/chatRouter.js';

type Screen = 'home' | 'login';

interface AppProps {
  debug?: boolean;
  workDir?: string;
}

export function App({ debug = false, workDir }: AppProps) {
  const { exit } = useApp();
  const effectiveWorkDir = workDir || join(homedir(), '.hakimi', 'workspace');
  const [screen, setScreen] = useState<Screen>('home');
  const [loggedIn, setLoggedIn] = useState(false);
  const [agentName, setAgentName] = useState('Hakimi');
  const [reloadKey, setReloadKey] = useState(0);
  const [botStatuses, setBotStatuses] = useState<BotStatusInfo[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastMessage, setLastMessage] = useState<{ sessionId: string; content: string } | null>(null);
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const initializedRef = useRef(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  }, []);

  const [chatRouter] = useState<ChatRouter>(
    () =>
      new ChatRouter({
        onMessage: (sessionId, content) => {
          setLastMessage({ sessionId, content });
          if (debug) addLog(`Message [${sessionId}]: ${content}`);
        },
        onSessionStart: (session: ChatSession) => {
          if (debug) addLog(`Session started: ${session.sessionId}`);
        },
        onSessionEnd: (sessionId) => {
          if (debug) addLog(`Session ended: ${sessionId}`);
        },
        onBotStatusChange: (bots) => {
          setBotStatuses(bots);
        },
        onLog: (message) => {
          if (debug) addLog(message);
        },
        debug,
        workDir,
      })
  );

  const startChat = useCallback(async () => {
    setChatError(null);
    const result = await chatRouter.start();
    if (!result.success) {
      setChatError(result.error || 'Unknown error');
    }
  }, [chatRouter]);

  const restartChat = useCallback(async () => {
    setChatError(null);
    const result = await chatRouter.restart();
    if (!result.success) {
      setChatError(result.error || 'Unknown error');
    }
  }, [chatRouter]);

  const refreshStatus = useCallback(async () => {
    const isLogged = await checkLoggedIn();
    setLoggedIn(isLogged);

    const config = await readHakimiConfig();
    setAgentName(config?.agentName || 'Hakimi');

    return { isLogged, botAccountsCount: config?.botAccounts?.length ?? 0 };
  }, []);

  // Initial load: check status and auto-start if configured
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      const { botAccountsCount } = await refreshStatus();
      if (botAccountsCount > 0) {
        await startChat();
      }
    })();
  }, [refreshStatus, startChat]);

  const handleLoginSuccess = useCallback(() => {
    setLoggedIn(true);
    setScreen('home');
    refreshStatus();
  }, [refreshStatus]);

  const handleConfigChange = useCallback(async () => {
    await refreshStatus();
    await restartChat();
    // Increment key to force terminal agent restart
    setReloadKey((k) => k + 1);
  }, [refreshStatus, restartChat]);

  const handleQuit = useCallback(async () => {
    if (chatRouter.running) {
      await chatRouter.stop();
    }
    exit();
  }, [chatRouter, exit]);

  return (
    <Box flexDirection="column">
      {screen === 'home' && (
        <HomeScreen
          key={reloadKey}
          isLoggedIn={loggedIn}
          botStatuses={botStatuses}
          chatError={chatError}
          workDir={effectiveWorkDir}
          agentName={agentName}
          onLogin={() => setScreen('login')}
          onConfigChange={handleConfigChange}
          onQuit={handleQuit}
          isActive={screen === 'home'}
          debug={debug}
        />
      )}

      {screen === 'login' && (
        <LoginScreen
          onSuccess={handleLoginSuccess}
          onCancel={() => setScreen('home')}
          isActive={screen === 'login'}
        />
      )}

      {chatRouter.running && debug && logs.length > 0 && (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          <Text color="gray">─── Debug Logs ───</Text>
          {logs.map((log, i) => (
            <Text key={i} color="gray" dimColor>
              {log}
            </Text>
          ))}
        </Box>
      )}

      {chatRouter.running && lastMessage && (
        <Box marginTop={1} paddingX={1}>
          <Text color="gray">Last IM: </Text>
          <Text color="cyan">[{lastMessage.sessionId}] </Text>
          <Text>{lastMessage.content.length > 50 ? lastMessage.content.slice(0, 50) + '...' : lastMessage.content}</Text>
        </Box>
      )}
    </Box>
  );
}

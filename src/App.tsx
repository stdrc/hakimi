import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import { homedir } from 'node:os';
import { HomeScreen } from './screens/HomeScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { ConfigScreen } from './screens/ConfigScreen.js';
import { isLoggedIn as checkLoggedIn, readHakimiConfig } from './utils/config.js';
import { ChatRouter, type ChatSession } from './services/chatRouter.js';

type Screen = 'home' | 'login' | 'config';

interface AppProps {
  debug?: boolean;
  workDir?: string;
}

export function App({ debug = false, workDir }: AppProps) {
  const { exit } = useApp();
  const effectiveWorkDir = workDir || homedir();
  const [screen, setScreen] = useState<Screen>('home');
  const [loggedIn, setLoggedIn] = useState(false);
  const [adaptersConfigured, setAdaptersConfigured] = useState(0);
  const [chatActive, setChatActive] = useState(false);
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
    if (result.success) {
      setChatActive(true);
    } else {
      setChatError(result.error || 'Unknown error');
      setChatActive(false);
    }
  }, [chatRouter]);

  const restartChat = useCallback(async () => {
    setChatError(null);
    const result = await chatRouter.restart();
    if (result.success) {
      setChatActive(true);
    } else {
      setChatError(result.error || 'Unknown error');
      setChatActive(false);
    }
  }, [chatRouter]);

  const stopChat = useCallback(async () => {
    await chatRouter.stop();
    setChatActive(false);
    setChatError(null);
  }, [chatRouter]);

  const refreshStatus = useCallback(async () => {
    const isLogged = await checkLoggedIn();
    setLoggedIn(isLogged);

    const config = await readHakimiConfig();
    setAdaptersConfigured(config?.adapters?.length ?? 0);

    return { isLogged, adaptersCount: config?.adapters?.length ?? 0 };
  }, []);

  // Initial load: check status and auto-start if configured
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      const { adaptersCount } = await refreshStatus();
      if (adaptersCount > 0) {
        await startChat();
      }
    })();
  }, [refreshStatus, startChat]);

  const handleLoginSuccess = useCallback(() => {
    setLoggedIn(true);
    setScreen('home');
    refreshStatus();
  }, [refreshStatus]);

  const handleConfigFinished = useCallback(async () => {
    setScreen('home');
    const { adaptersCount } = await refreshStatus();
    if (adaptersCount > 0) {
      await restartChat();
    }
  }, [refreshStatus, restartChat]);

  const handleToggleChat = useCallback(async () => {
    if (chatActive) {
      await stopChat();
    } else {
      await startChat();
    }
  }, [chatActive, startChat, stopChat]);

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
          isLoggedIn={loggedIn}
          adaptersConfigured={adaptersConfigured}
          chatActive={chatActive}
          chatError={chatError}
          workDir={effectiveWorkDir}
          onLogin={() => setScreen('login')}
          onConfig={() => setScreen('config')}
          onChat={handleToggleChat}
          onQuit={handleQuit}
          isActive={screen === 'home'}
        />
      )}

      {screen === 'login' && (
        <LoginScreen
          onSuccess={handleLoginSuccess}
          onCancel={() => setScreen('home')}
          isActive={screen === 'login'}
        />
      )}

      {screen === 'config' && (
        <ConfigScreen
          onFinished={handleConfigFinished}
          onCancel={() => setScreen('home')}
          isActive={screen === 'config'}
        />
      )}

      {chatActive && debug && logs.length > 0 && (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          <Text color="gray">─── Debug Logs ───</Text>
          {logs.map((log, i) => (
            <Text key={i} color="gray" dimColor>
              {log}
            </Text>
          ))}
        </Box>
      )}

      {chatActive && lastMessage && (
        <Box marginTop={1} paddingX={1}>
          <Text color="gray">上次收到: </Text>
          <Text color="cyan">[{lastMessage.sessionId}] </Text>
          <Text>{lastMessage.content.length > 50 ? lastMessage.content.slice(0, 50) + '...' : lastMessage.content}</Text>
        </Box>
      )}
    </Box>
  );
}

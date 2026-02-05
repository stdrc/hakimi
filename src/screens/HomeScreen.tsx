import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { StatusBar } from '../components/StatusBar.js';
import type { BotStatusInfo } from '../services/chatRouter.js';
import { TheAgent } from '../services/theAgent.js';

interface HomeScreenProps {
  isLoggedIn: boolean;
  hasBotAccounts: boolean;
  botStatuses: BotStatusInfo[];
  chatError: string | null;
  workDir: string;
  agentName: string;
  onLogin: () => void;
  onConfigChange: () => void;
  onQuit: () => void;
  isActive: boolean;
  debug?: boolean;
}

export function HomeScreen({
  isLoggedIn,
  hasBotAccounts,
  botStatuses,
  chatError,
  workDir,
  agentName,
  onLogin,
  onConfigChange,
  onQuit,
  isActive,
  debug,
}: HomeScreenProps) {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const agentRef = useRef<TheAgent | null>(null);
  const agentStartedRef = useRef(false);

  // Initialize terminal agent when logged in
  useEffect(() => {
    if (!isLoggedIn || agentStartedRef.current) return;
    agentStartedRef.current = true;

    const agent = new TheAgent('terminal', agentName, {
      onSend: async (message) => {
        setLastResponse(message);
      },
      onLog: debug ? (msg) => console.log(`[Agent] ${msg}`) : undefined,
      onConfigChange,
      workDir,
      isTerminal: true,
    });

    agentRef.current = agent;

    agent.start()
      .then(async () => {
        // Auto-prompt for config if no bot accounts configured
        if (!hasBotAccounts) {
          setIsProcessing(true);
          try {
            await agent.sendMessage('Hello! I just started Hakimi and need help setting up. Please guide me through the initial configuration.');
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setIsProcessing(false);
          }
        }
      })
      .catch((err) => {
        setError(err.message);
      });

    return () => {
      agent.close();
    };
  }, [isLoggedIn, hasBotAccounts, agentName, workDir, onConfigChange, debug]);

  const handleSubmit = useCallback(async (value: string) => {
    if (!value.trim()) return;

    const agent = agentRef.current;
    if (!agent) {
      setError('Agent not ready');
      return;
    }

    setInputValue('');
    setIsProcessing(true);
    setError(null);
    setLastResponse('');

    try {
      await agent.sendMessage(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  }, []);

  useInput(
    (input, key) => {
      if (key.escape) {
        onQuit();
      } else if ((input === 'l' || input === 'L') && !isLoggedIn) {
        onLogin();
      }
    },
    { isActive: isActive && !isProcessing }
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">
          Hakimi - Your AI Companion That Grows With You
        </Text>
      </Box>

      <StatusBar
        isLoggedIn={isLoggedIn}
        botStatuses={botStatuses}
        chatError={chatError}
        workDir={workDir}
      />

      {!isLoggedIn ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">Press L to login to Kimi Code first</Text>
          <Box marginTop={1}>
            <Text color="gray">[L] Login  [Esc] Quit</Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          {error && (
            <Box marginBottom={1}>
              <Text color="red">Error: {error}</Text>
            </Box>
          )}

          {lastResponse && (
            <Box marginBottom={1}>
              <Text color="green">{agentName}: </Text>
              <Text>{lastResponse}</Text>
            </Box>
          )}

          <Box>
            {isProcessing ? (
              <Box>
                <Spinner type="dots" />
                <Text color="gray"> ...</Text>
              </Box>
            ) : (
              <Box>
                <Text color="cyan">You: </Text>
                <TextInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={handleSubmit}
                />
              </Box>
            )}
          </Box>

          <Box marginTop={1}>
            <Text color="gray">[Esc] Quit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

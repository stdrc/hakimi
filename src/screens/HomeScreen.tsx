import React from 'react';
import { Box, Text, useInput } from 'ink';
import { StatusBar } from '../components/StatusBar.js';
import { HotkeyHint } from '../components/HotkeyHint.js';
import type { BotStatusInfo } from '../services/chatRouter.js';

interface HomeScreenProps {
  isLoggedIn: boolean;
  botAccountsConfigured: number;
  botStatuses: BotStatusInfo[];
  chatError: string | null;
  chatRunning: boolean;
  workDir: string;
  onLogin: () => void;
  onConfig: () => void;
  onChat: () => void;
  onQuit: () => void;
  isActive: boolean;
}

export function HomeScreen({
  isLoggedIn,
  botAccountsConfigured,
  botStatuses,
  chatError,
  chatRunning,
  workDir,
  onLogin,
  onConfig,
  onChat,
  onQuit,
  isActive,
}: HomeScreenProps) {
  useInput(
    (input) => {
      if (input === 'l' || input === 'L') {
        onLogin();
      } else if ((input === 'c' || input === 'C') && isLoggedIn) {
        onConfig();
      } else if ((input === 's' || input === 'S') && isLoggedIn && botAccountsConfigured > 0) {
        onChat();
      } else if (input === 'q' || input === 'Q') {
        onQuit();
      }
    },
    { isActive }
  );

  const hints = [
    { key: 'L', label: 'Login', disabled: isLoggedIn },
    { key: 'C', label: 'Configure', disabled: !isLoggedIn },
    { key: 'S', label: chatRunning ? 'Stop' : 'Start', disabled: !isLoggedIn || botAccountsConfigured === 0 },
    { key: 'Q', label: 'Quit' },
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">
          Hakimi - Kimi Chat Router
        </Text>
      </Box>

      <StatusBar
        isLoggedIn={isLoggedIn}
        botStatuses={botStatuses}
        chatError={chatError}
        workDir={workDir}
      />

      <HotkeyHint hints={hints} />

      {!isLoggedIn && (
        <Box marginTop={1}>
          <Text color="yellow">Press L to login to Kimi first</Text>
        </Box>
      )}

      {isLoggedIn && botAccountsConfigured === 0 && (
        <Box marginTop={1}>
          <Text color="yellow">Press C to configure bot accounts</Text>
        </Box>
      )}
    </Box>
  );
}

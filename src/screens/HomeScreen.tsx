import React from 'react';
import { Box, Text, useInput } from 'ink';
import { StatusBar } from '../components/StatusBar.js';
import { HotkeyHint } from '../components/HotkeyHint.js';

interface HomeScreenProps {
  isLoggedIn: boolean;
  adaptersConfigured: number;
  chatActive: boolean;
  onLogin: () => void;
  onConfig: () => void;
  onChat: () => void;
  onQuit: () => void;
  isActive: boolean;
}

export function HomeScreen({
  isLoggedIn,
  adaptersConfigured,
  chatActive,
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
      } else if ((input === 's' || input === 'S') && isLoggedIn && adaptersConfigured > 0) {
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
    { key: 'S', label: chatActive ? 'Stop Chat' : 'Start Chat', disabled: !isLoggedIn || adaptersConfigured === 0 },
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
        adaptersConfigured={adaptersConfigured}
        chatActive={chatActive}
      />

      <HotkeyHint hints={hints} />

      {!isLoggedIn && (
        <Box marginTop={1}>
          <Text color="yellow">Press L to login to Kimi first</Text>
        </Box>
      )}

      {isLoggedIn && adaptersConfigured === 0 && (
        <Box marginTop={1}>
          <Text color="yellow">Press C to configure chat adapters</Text>
        </Box>
      )}
    </Box>
  );
}

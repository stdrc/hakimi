import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  isLoggedIn: boolean;
  adaptersConfigured: number;
  chatActive: boolean;
}

export function StatusBar({ isLoggedIn, adaptersConfigured, chatActive }: StatusBarProps) {
  return (
    <Box borderStyle="single" paddingX={1} flexDirection="column">
      <Text bold>Hakimi Status</Text>
      <Box>
        <Text>Kimi: </Text>
        {isLoggedIn ? (
          <Text color="green">Logged in</Text>
        ) : (
          <Text color="yellow">Not logged in</Text>
        )}
      </Box>
      <Box>
        <Text>Adapters: </Text>
        {adaptersConfigured > 0 ? (
          <Text color="green">{adaptersConfigured} configured</Text>
        ) : (
          <Text color="yellow">None configured</Text>
        )}
      </Box>
      <Box>
        <Text>Chat: </Text>
        {chatActive ? (
          <Text color="green">Active</Text>
        ) : (
          <Text color="gray">Inactive</Text>
        )}
      </Box>
    </Box>
  );
}

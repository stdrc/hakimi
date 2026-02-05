import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  isLoggedIn: boolean;
  adaptersConfigured: number;
  chatActive: boolean;
  chatError: string | null;
  workDir: string;
}

export function StatusBar({ isLoggedIn, adaptersConfigured, chatActive, chatError, workDir }: StatusBarProps) {
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
        {chatError ? (
          <Text color="red">Error</Text>
        ) : chatActive ? (
          <Text color="green">Active</Text>
        ) : (
          <Text color="gray">Inactive</Text>
        )}
      </Box>
      {chatError && (
        <Box>
          <Text color="red">  └─ {chatError}</Text>
        </Box>
      )}
      <Box>
        <Text>WorkDir: </Text>
        <Text color="cyan">{workDir}</Text>
      </Box>
    </Box>
  );
}

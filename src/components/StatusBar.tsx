import React from 'react';
import { Box, Text } from 'ink';
import type { BotStatusInfo } from '../services/chatRouter.js';

interface StatusBarProps {
  isLoggedIn: boolean;
  botStatuses: BotStatusInfo[];
  chatError: string | null;
  workDir: string;
}

function getBotStatusColor(status: BotStatusInfo['status']): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'connecting':
      return 'yellow';
    case 'error':
      return 'red';
    case 'inactive':
    default:
      return 'gray';
  }
}

function getBotStatusText(status: BotStatusInfo['status']): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'connecting':
      return 'Connecting...';
    case 'error':
      return 'Error';
    case 'inactive':
    default:
      return 'Inactive';
  }
}

function formatBotName(bot: BotStatusInfo): string {
  const platform = bot.type.charAt(0).toUpperCase() + bot.type.slice(1);
  // Prefer name over selfId
  const identifier = bot.name || bot.selfId;
  if (identifier) {
    return `${platform} (${identifier})`;
  }
  return platform;
}

export function StatusBar({ isLoggedIn, botStatuses, chatError, workDir }: StatusBarProps) {
  return (
    <Box borderStyle="single" paddingX={1} flexDirection="column">
      <Text bold>Hakimi Status</Text>
      <Box>
        <Text>Kimi Code: </Text>
        {isLoggedIn ? (
          <Text color="green">Logged in</Text>
        ) : (
          <Text color="yellow">Not logged in</Text>
        )}
      </Box>
      
      {botStatuses.length > 0 ? (
        <Box flexDirection="column">
          <Text>Bot Accounts:</Text>
          {botStatuses.map((bot, index) => (
            <Box key={index} paddingLeft={2}>
              <Text color={getBotStatusColor(bot.status)}>
                • {formatBotName(bot)}: {getBotStatusText(bot.status)}
              </Text>
            </Box>
          ))}
        </Box>
      ) : (
        <Box>
          <Text>Bot Accounts: </Text>
          <Text color="gray">None configured</Text>
        </Box>
      )}
      
      {chatError && (
        <Box>
          <Text color="red">Error: {chatError}</Text>
        </Box>
      )}
      
      <Box>
        <Text>WorkDir: </Text>
        <Text color="cyan">{workDir}</Text>
      </Box>
    </Box>
  );
}

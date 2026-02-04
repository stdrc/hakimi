import React from 'react';
import { Box, Text } from 'ink';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface MessageLogProps {
  messages: Message[];
  maxHeight?: number;
}

export function MessageLog({ messages, maxHeight = 10 }: MessageLogProps) {
  const visibleMessages = messages.slice(-maxHeight);

  return (
    <Box flexDirection="column">
      {visibleMessages.length === 0 ? (
        <Text color="gray">No messages yet...</Text>
      ) : (
        visibleMessages.map((msg) => (
          <Box key={msg.id} flexDirection="row">
            <Text
              color={
                msg.role === 'user'
                  ? 'blue'
                  : msg.role === 'assistant'
                    ? 'green'
                    : 'yellow'
              }
              bold
            >
              {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Hakimi' : 'System'}:
            </Text>
            <Text> {msg.content}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}

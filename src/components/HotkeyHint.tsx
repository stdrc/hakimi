import React from 'react';
import { Box, Text } from 'ink';

interface HotkeyHintProps {
  hints: Array<{ key: string; label: string; disabled?: boolean }>;
}

export function HotkeyHint({ hints }: HotkeyHintProps) {
  return (
    <Box gap={2} marginTop={1}>
      {hints.map(({ key, label, disabled }) => (
        <Box key={key}>
          <Text color={disabled ? 'gray' : 'cyan'} bold>[{key}]</Text>
          <Text color={disabled ? 'gray' : undefined}> {label}</Text>
        </Box>
      ))}
    </Box>
  );
}

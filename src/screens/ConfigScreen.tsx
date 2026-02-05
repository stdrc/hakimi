import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { ConfigAgent } from '../services/configAgent.js';

interface ConfigScreenProps {
  onFinished: () => void;
  onCancel: () => void;
  isActive: boolean;
}

export function ConfigScreen({ onFinished, onCancel, isActive }: ConfigScreenProps) {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>('');
  const agentRef = useRef<ConfigAgent | null>(null);
  const currentResponseRef = useRef<string>('');
  const pendingResolveRef = useRef<((answer: string) => void) | null>(null);

  const flushCurrentResponse = useCallback(() => {
    if (currentResponseRef.current.trim()) {
      setLastResponse(currentResponseRef.current.trim());
      currentResponseRef.current = '';
    }
  }, []);

  useEffect(() => {
    const agent = new ConfigAgent({
      onText: (text) => {
        currentResponseRef.current += text;
      },
      onAskUser: async (question) => {
        flushCurrentResponse();
        return new Promise((resolve) => {
          pendingResolveRef.current = resolve;
          setLastResponse(question);
          setIsProcessing(false);
        });
      },
      onError: (err) => {
        flushCurrentResponse();
        setError(err.message);
        setIsProcessing(false);
      },
    });

    agentRef.current = agent;

    agent.start().then(() => {
      flushCurrentResponse();
      setIsProcessing(false);
    }).catch((err) => {
      setError(err.message);
      setIsProcessing(false);
    });

    return () => {
      agent.close();
    };
  }, [flushCurrentResponse]);

  const handleSubmit = useCallback(
    async (value: string) => {
      if (!value.trim()) return;

      const agent = agentRef.current;
      if (!agent) return;

      setInputValue('');
      setIsProcessing(true);
      setError(null);

      // If there's a pending AskUser, resolve it
      if (pendingResolveRef.current) {
        const resolve = pendingResolveRef.current;
        pendingResolveRef.current = null;
        resolve(value);
      } else {
        // Otherwise send as a new message
        flushCurrentResponse();
        try {
          await agent.sendMessage(value);
          flushCurrentResponse();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        setIsProcessing(false);
      }
    },
    [flushCurrentResponse]
  );

  useInput(
    (input, key) => {
      if (key.escape) {
        agentRef.current?.close();
        onFinished();
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Configure Adapters
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {lastResponse && (
        <Box marginBottom={1} flexDirection="column">
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
            <Text color="green">&gt; </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
            />
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">[Esc] Exit</Text>
      </Box>
    </Box>
  );
}

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { MessageLog, type Message } from '../components/MessageLog.js';
import { ConfigAgent } from '../services/configAgent.js';

interface ConfigScreenProps {
  onFinished: () => void;
  onCancel: () => void;
  isActive: boolean;
}

type InputMode = 'chat' | 'ask_user';

interface PendingQuestion {
  question: string;
  resolve: (answer: string) => void;
}

export function ConfigScreen({ onFinished, onCancel, isActive }: ConfigScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('chat');
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agentRef = useRef<ConfigAgent | null>(null);
  const currentResponseRef = useRef<string>('');

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        role,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const flushCurrentResponse = useCallback(() => {
    if (currentResponseRef.current.trim()) {
      addMessage('assistant', currentResponseRef.current.trim());
      currentResponseRef.current = '';
    }
  }, [addMessage]);

  useEffect(() => {
    const agent = new ConfigAgent({
      onText: (text) => {
        currentResponseRef.current += text;
      },
      onAskUser: async (question) => {
        flushCurrentResponse();
        return new Promise((resolve) => {
          setPendingQuestion({ question, resolve });
          setInputMode('ask_user');
          setInputValue('');
          addMessage('assistant', question);
          setIsProcessing(false);
        });
      },
      onFinished: () => {
        flushCurrentResponse();
        setIsFinished(true);
        addMessage('system', 'Configuration saved successfully!');
        setIsProcessing(false);
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
  }, [addMessage, flushCurrentResponse]);

  const handleSubmit = useCallback(
    async (value: string) => {
      if (!value.trim()) return;

      const agent = agentRef.current;
      if (!agent) return;

      if (inputMode === 'ask_user' && pendingQuestion) {
        addMessage('user', value);
        pendingQuestion.resolve(value);
        setPendingQuestion(null);
        setInputMode('chat');
        setIsProcessing(true);
      } else {
        addMessage('user', value);
        setIsProcessing(true);
        flushCurrentResponse();

        try {
          await agent.sendMessage(value);
          flushCurrentResponse();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        setIsProcessing(false);
      }

      setInputValue('');
    },
    [inputMode, pendingQuestion, addMessage, flushCurrentResponse]
  );

  useInput(
    (input, key) => {
      if (key.escape) {
        agentRef.current?.close();
        if (isFinished) {
          onFinished();
        } else {
          onCancel();
        }
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Adapter Configuration
        </Text>
        {isFinished && <Text color="green"> (Complete)</Text>}
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      <MessageLog messages={messages} maxHeight={15} />

      <Box marginTop={1}>
        {isProcessing ? (
          <Box>
            <Spinner type="dots" />
            <Text color="gray"> Thinking...</Text>
          </Box>
        ) : (
          <Box>
            <Text color={inputMode === 'ask_user' ? 'yellow' : 'blue'}>
              {inputMode === 'ask_user' ? '? ' : '> '}
            </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
            />
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">[Esc] {isFinished ? 'Done' : 'Cancel'}</Text>
      </Box>
    </Box>
  );
}

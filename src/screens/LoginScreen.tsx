import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { startLogin, type LoginEvent } from '../services/loginService.js';

interface LoginScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
  isActive: boolean;
}

type LoginState = 'starting' | 'awaiting_auth' | 'success' | 'error';

export function LoginScreen({ onSuccess, onCancel, isActive }: LoginScreenProps) {
  const [state, setState] = useState<LoginState>('starting');
  const [verificationUrl, setVerificationUrl] = useState<string>('');
  const [userCode, setUserCode] = useState<string>('');
  const [message, setMessage] = useState<string>('Starting login...');
  const [error, setError] = useState<string>('');

  useInput(
    (input, key) => {
      if (key.escape || input === 'q' || input === 'Q') {
        onCancel();
      }
      if (state === 'success' && (key.return || input === ' ')) {
        onSuccess();
      }
    },
    { isActive }
  );

  useEffect(() => {
    const emitter = startLogin();

    emitter.on('event', (event: LoginEvent) => {
      switch (event.type) {
        case 'verification_url':
          setState('awaiting_auth');
          setVerificationUrl(event.data?.verification_url || '');
          setUserCode(event.data?.user_code || '');
          setMessage('Please authorize in your browser');
          break;
        case 'waiting':
          setMessage(event.message);
          break;
        case 'success':
          setState('success');
          setMessage(event.message);
          break;
        case 'error':
          setState('error');
          setError(event.message);
          break;
        case 'info':
          setMessage(event.message);
          break;
      }
    });

    emitter.on('error', (err) => {
      setState('error');
      setError(err.message);
    });

    return () => {
      emitter.removeAllListeners();
    };
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Kimi Login
        </Text>
      </Box>

      {state === 'starting' && (
        <Box>
          <Spinner type="dots" />
          <Text> {message}</Text>
        </Box>
      )}

      {state === 'awaiting_auth' && (
        <Box flexDirection="column" borderStyle="round" padding={1}>
          <Text>Open this URL in your browser:</Text>
          <Box marginY={1}>
            <Text bold color="blue">
              {verificationUrl}
            </Text>
          </Box>
          <Text>Enter this code:</Text>
          <Box marginY={1}>
            <Text bold color="green" inverse>
              {' '}{userCode}{' '}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text color="gray"> {message}</Text>
          </Box>
        </Box>
      )}

      {state === 'success' && (
        <Box flexDirection="column">
          <Text color="green">{message}</Text>
          <Box marginTop={1}>
            <Text color="gray">Press Enter to continue...</Text>
          </Box>
        </Box>
      )}

      {state === 'error' && (
        <Box flexDirection="column">
          <Text color="red">Error: {error}</Text>
          <Box marginTop={1}>
            <Text color="gray">Press Esc to go back</Text>
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">[Esc] Cancel</Text>
      </Box>
    </Box>
  );
}

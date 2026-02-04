import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface LoginEvent {
  type: 'info' | 'verification_url' | 'waiting' | 'success' | 'error';
  message: string;
  data?: {
    verification_url?: string;
    user_code?: string;
  };
}

export interface LoginEmitter extends EventEmitter {
  on(event: 'event', listener: (data: LoginEvent) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'close', listener: () => void): this;
}

export function startLogin(): LoginEmitter {
  const emitter = new EventEmitter() as LoginEmitter;

  const proc = spawn('kimi', ['login', '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let buffer = '';

  proc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as LoginEvent;
        emitter.emit('event', event);
      } catch {
        // Ignore non-JSON lines
      }
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    const message = chunk.toString().trim();
    if (message) {
      emitter.emit('event', { type: 'error', message });
    }
  });

  proc.on('error', (err) => {
    emitter.emit('error', err);
  });

  proc.on('close', () => {
    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer) as LoginEvent;
        emitter.emit('event', event);
      } catch {
        // Ignore
      }
    }
    emitter.emit('close');
  });

  return emitter;
}

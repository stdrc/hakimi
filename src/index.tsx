#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

const debug = process.argv.includes('--debug');

// Global error handlers to prevent crash
process.on('uncaughtException', (error) => {
  if (debug) {
    console.error('[Uncaught Exception]', error);
  }
  // Don't exit - let the app continue
});

process.on('unhandledRejection', (reason) => {
  if (debug) {
    console.error('[Unhandled Rejection]', reason);
  }
  // Don't exit - let the app continue
});

render(<App debug={debug} />);

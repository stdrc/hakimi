#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './App.js';

const cli = meow(`
  Usage
    $ hakimi [options]

  Options
    --workdir, -w  Working directory for the agent (default: home directory)
    --debug        Enable debug logging
    --help         Show this help message
    --version      Show version number
`, {
  importMeta: import.meta,
  flags: {
    workdir: {
      type: 'string',
      shortFlag: 'w',
    },
    debug: {
      type: 'boolean',
      default: false,
    },
  },
});

const { debug, workdir } = cli.flags;

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

render(<App debug={debug} workDir={workdir} />);

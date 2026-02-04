import { homedir } from 'node:os';
import { join } from 'node:path';

export const KIMI_DIR = join(homedir(), '.kimi');
export const KIMI_CONFIG = join(KIMI_DIR, 'config.toml');

export const HAKIMI_DIR = join(homedir(), '.hakimi');
export const HAKIMI_CONFIG = join(HAKIMI_DIR, 'config.toml');

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import * as TOML from '@iarna/toml';
import { KIMI_CONFIG, HAKIMI_DIR, HAKIMI_CONFIG } from './paths.js';

export interface KimiConfig {
  default_model?: string;
  [key: string]: unknown;
}

export interface BotAccountConfig {
  type: 'telegram' | 'slack' | 'feishu';
  config: Record<string, unknown>;
}

export interface HakimiConfig {
  agentName?: string;
  botAccounts?: BotAccountConfig[];
}

export async function readKimiConfig(): Promise<KimiConfig | null> {
  try {
    if (!existsSync(KIMI_CONFIG)) {
      return null;
    }
    const content = await readFile(KIMI_CONFIG, 'utf-8');
    return TOML.parse(content) as KimiConfig;
  } catch {
    return null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const config = await readKimiConfig();
  return config !== null && typeof config.default_model === 'string';
}

export async function readHakimiConfig(): Promise<HakimiConfig | null> {
  try {
    if (!existsSync(HAKIMI_CONFIG)) {
      return null;
    }
    const content = await readFile(HAKIMI_CONFIG, 'utf-8');
    return TOML.parse(content) as HakimiConfig;
  } catch {
    return null;
  }
}

export async function writeHakimiConfig(config: HakimiConfig): Promise<void> {
  if (!existsSync(HAKIMI_DIR)) {
    await mkdir(HAKIMI_DIR, { recursive: true });
  }
  const dir = dirname(HAKIMI_CONFIG);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const content = TOML.stringify(config as TOML.JsonMap);
  await writeFile(HAKIMI_CONFIG, content, 'utf-8');
}

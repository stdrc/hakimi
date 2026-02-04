import { homedir } from 'node:os';
import { join } from 'node:path';

export const KIMI_DIR = join(homedir(), '.kimi');
export const KIMI_CONFIG = join(KIMI_DIR, 'config.toml');

export const HAKIMI_DIR = join(homedir(), '.hakimi');
export const HAKIMI_CONFIG = join(HAKIMI_DIR, 'config.toml');

export function getSystemLanguage(): string {
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || 'en';
  // Extract language code (e.g., "zh_CN.UTF-8" -> "zh_CN", "en_US.UTF-8" -> "en_US")
  const match = lang.match(/^([a-z]{2}(?:_[A-Z]{2})?)/i);
  return match ? match[1] : 'en';
}

export function getLanguageInstruction(): string {
  const lang = getSystemLanguage();
  if (lang.startsWith('zh')) {
    return 'Please respond in Chinese (中文).';
  } else if (lang.startsWith('ja')) {
    return 'Please respond in Japanese (日本語).';
  } else if (lang.startsWith('ko')) {
    return 'Please respond in Korean (한국어).';
  } else if (lang.startsWith('es')) {
    return 'Please respond in Spanish (Español).';
  } else if (lang.startsWith('fr')) {
    return 'Please respond in French (Français).';
  } else if (lang.startsWith('de')) {
    return 'Please respond in German (Deutsch).';
  }
  return 'Please respond in the user\'s language.';
}

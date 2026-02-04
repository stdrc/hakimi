import { z } from 'zod';
import { writeHakimiConfig, type AdapterConfig } from '../utils/config.js';

export const adapterConfigSchema = z.object({
  type: z.enum(['telegram', 'slack', 'feishu']),
  config: z.record(z.any()),
});

export const finishConfigSchema = z.object({
  adapters: z.array(adapterConfigSchema).describe('List of adapter configurations to save'),
});

export type FinishConfigParams = z.infer<typeof finishConfigSchema>;

export interface FinishConfigResult {
  output: string;
}

export function createFinishConfigTool() {
  return {
    name: 'FinishConfig',
    description: 'Save configuration to ~/.hakimi/config.toml',
    parameters: finishConfigSchema,
    handler: async (params: FinishConfigParams): Promise<FinishConfigResult> => {
      await writeHakimiConfig({ adapters: params.adapters as AdapterConfig[] });
      return { output: `Saved ${params.adapters.length} adapter(s) to config` };
    },
  };
}

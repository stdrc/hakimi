import { z } from 'zod';

export const askUserSchema = z.object({
  question: z.string().describe('The question to ask the user'),
  inputType: z.enum(['text', 'password']).default('text').describe('Type of input field'),
});

export type AskUserParams = z.infer<typeof askUserSchema>;

export interface AskUserResult {
  output: string;
}

export function createAskUserTool(handler: (params: AskUserParams) => Promise<string>) {
  return {
    name: 'AskUser',
    description: 'Ask user for input like API tokens, configuration values, or choices',
    parameters: askUserSchema,
    handler: async (params: AskUserParams): Promise<AskUserResult> => {
      const answer = await handler(params);
      return { output: answer };
    },
  };
}

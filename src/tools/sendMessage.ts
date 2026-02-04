import { z } from 'zod';

export const sendMessageSchema = z.object({
  message: z.string().describe('The message to send to the user'),
});

export type SendMessageParams = z.infer<typeof sendMessageSchema>;

export interface SendMessageResult {
  output: string;
}

export type SendFunction = (message: string) => Promise<void>;

export function createSendMessageTool(sendFn: SendFunction) {
  return {
    name: 'SendMessage',
    description:
      'Send reply to user. You MUST use this tool to send messages. Do NOT put reply in assistant message content.',
    parameters: sendMessageSchema,
    handler: async (params: SendMessageParams): Promise<SendMessageResult> => {
      await sendFn(params.message);
      return { output: 'sent' };
    },
  };
}

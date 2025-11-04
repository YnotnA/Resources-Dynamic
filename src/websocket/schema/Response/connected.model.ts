import { z } from "zod";

export const connectedMessageSchema = z.object({
  type: z.literal("connected"),
  clientId: z.string(),
  timestamp: z.number(),
});

export type ConnectedMessageType = z.infer<typeof connectedMessageSchema>;

import { z } from "zod";

export const pongMessageSchema = z.object({
  type: z.literal("pong"),
  timestamp: z.number(),
});

export type PongMessageType = z.infer<typeof pongMessageSchema>;

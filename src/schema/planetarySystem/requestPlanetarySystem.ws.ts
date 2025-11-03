import { z } from "zod";

export const nextTicksSchema = z.object({
  action: z.literal("next-ticks"),
  target: z.uuid(),
  fromTime: z.float32(),
  count: z.number().int().positive().default(60),
});

export type NextTicksType = z.infer<typeof nextTicksSchema>;

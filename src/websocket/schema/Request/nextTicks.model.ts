import { z } from "zod";

export const nextTicksSchema = z.object({
  action: z.literal("next-ticks"),
  target: z.uuid(),
  fromTime: z.float32(),
  count: z.number().int().positive().default(60),
  timeStep: z.number().int().positive().optional(),
});

export type NextTicksType = z.infer<typeof nextTicksSchema>;

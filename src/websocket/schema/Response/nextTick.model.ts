import { z } from "zod";

import { vector3Schema } from "../vector3.model";

export const nextTickDataSchema = z.object({
  uuid: z.string(),
  position: vector3Schema,
  rotation: vector3Schema,
  time: z.number(),
});

export const nextTicksMessageSchema = z.object({
  type: z.literal("next-ticks"),
  data: z.array(nextTickDataSchema),
});

export type NextTickDataType = z.infer<typeof nextTickDataSchema>;
export type NextTicksMessageType = z.infer<typeof nextTicksMessageSchema>;

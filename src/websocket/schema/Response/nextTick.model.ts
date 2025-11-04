import { z } from "zod";

import { vector3Schema } from "../vector3.model";

export const nextTickMessageSchema = z.object({
  uuid: z.string(),
  position: vector3Schema,
  rotation: vector3Schema,
  time: z.number(),
});

export const nextTicksMessageSchema = z.array(nextTickMessageSchema);

export type NextTickMessageType = z.infer<typeof nextTickMessageSchema>;
export type NextTicksMessageType = z.infer<typeof nextTicksMessageSchema>;

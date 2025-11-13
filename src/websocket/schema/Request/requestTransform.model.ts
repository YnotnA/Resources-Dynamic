import { z } from "zod";

export const requestTransformBase = z.object({
  duration_s: z.number().int().positive(),
  frequency: z.number().int().positive(),
  from_timestamp: z.number().int().min(0),
});

export type RequestTransformBaseType = z.infer<typeof requestTransformBase>;

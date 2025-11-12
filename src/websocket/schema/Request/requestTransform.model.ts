import { z } from "zod";

export const requestTransform = z.object({
  duration_s: z.number().int().positive(),
  frequency: z.number().int().positive(),
  from_timestamp: z.number().int().min(0),
});

export type RequestTransformType = z.infer<typeof requestTransform>;

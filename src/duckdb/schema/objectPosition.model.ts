import { z } from "zod";

export const objectPositionSchema = z.object({
  time_s: z.number(),
  type_id: z.number(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export type ObjectPositionType = z.infer<typeof objectPositionSchema>;

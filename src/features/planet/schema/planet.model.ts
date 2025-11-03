import { z } from "zod";

export const planetSchema = z.object({
  time_s: z.number(),
  x: z.number(),
  y: z.number(),
  z: z.number()
})

export type PlanetType = z.infer<typeof planetSchema>;

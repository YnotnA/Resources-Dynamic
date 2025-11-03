import { z } from "zod";

export const planetarySystemSchema = z.object({
  time_s: z.number(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export type PlanetarySystemType = z.infer<typeof planetarySystemSchema>;

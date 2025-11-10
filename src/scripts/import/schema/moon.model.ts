import { z } from "zod";

import { atmosphereSchema } from "./atmosphere.model";
import { compositionSchema } from "./composition.model";
import { resourcesSchema } from "./resources.model";
import { temperaturesSchema } from "./temperatures.model";

export const moonSchema = z.object({
  name: z.string(),
  index: z.number().nullable(),
  albedo: z.number().nullable(),
  radius_km: z.number().nullable(),
  radius_Re: z.number().nullable(),
  mass_Me: z.number().nullable(),
  mass_kg: z.number().nullable(),
  semi_major_km: z.number().nullable(),
  apoapsis_km: z.number().nullable(),
  periapsis_km: z.number().nullable(),
  eccentricity: z.number().nullable(),
  inclination_deg: z.number().nullable(),
  spin_locked: z.boolean().optional(),
  spin_period_h: z.number().nullable(),
  period_days: z.number().nullable(),
  atmosphere: atmosphereSchema,
  composition_bulk_pct: compositionSchema,
  resources: resourcesSchema,
  temperatures: temperaturesSchema,
});

export type MoonType = z.infer<typeof moonSchema>;

import { relations } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";

import { planets } from "./planets";

export const moons = pgTable("planet_moons", {
  id: serial("id").primaryKey(),
  planetId: integer("planet_id").references(() => planets.id),
  uuid: uuid("uuid").defaultRandom().unique(),
  name: text("name").notNull(),
  internalName: text("internal_name").notNull(),
  massKg: doublePrecision("mass_kg").notNull(),
  periapsisAu: doublePrecision("periapsis_au").notNull(),
  apoapsisAu: doublePrecision("apoapsis_au").notNull(),
  incDeg: doublePrecision("inc_deg").notNull(),
  nodeDeg: doublePrecision("node_deg").notNull(),
  argPeriDeg: doublePrecision("arg_peri_deg").notNull(),
  meanAnomalyDeg: doublePrecision("mean_anomaly_deg").notNull(),
  radiusKm: doublePrecision("radius_km").notNull(),
  radiusGravityInfluenceKm: doublePrecision(
    "radius_gravity_influence_km",
  ).notNull(),
});

// Relations
export const moonsRelations = relations(moons, ({ one }) => ({
  planet: one(planets, {
    fields: [moons.planetId],
    references: [planets.id],
  }),
}));

export const moonSchema = createSelectSchema(moons);
export const createMoonSchema = createInsertSchema(moons);
export const updateMoonSchema = createUpdateSchema(moons);

export type Moon = z.infer<typeof moonSchema>;
export type NewMoon = z.infer<typeof createMoonSchema>;
export type UpdateMoon = z.infer<typeof updateMoonSchema>;

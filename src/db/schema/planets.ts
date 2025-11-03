import { relations } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { planetMoons } from "./moons";
import { systems } from "./systems";

export const planets = pgTable("planets", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().unique(),
  systemId: integer("system_id").references(() => systems.id),
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
export const planetsRelations = relations(planets, ({ one, many }) => ({
  system: one(systems, {
    fields: [planets.systemId],
    references: [systems.id],
  }),
  moons: many(planetMoons),
}));

export type Planet = typeof planets.$inferSelect;
export type NewPlanet = typeof planets.$inferInsert;

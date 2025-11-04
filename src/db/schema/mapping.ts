import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type { z } from "zod";

export const CELESTIAL_BODY_TYPES = ["star", "planet", "moon"] as const;

export const celestialBodiesMapping = pgTable(
  "celestial_bodies_mapping",
  {
    uuid: uuid("uuid").primaryKey(),
    id: integer("id").notNull(),
    type: text("type", { enum: CELESTIAL_BODY_TYPES }).notNull(),
    name: text("name").notNull(),
    systemId: integer("system_id").notNull(),
    parentId: integer("parent_id"), // planet_id pour les lunes
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_celestial_mapping_id_type").on(table.id, table.type),
    index("idx_celestial_mapping_system").on(table.systemId),
  ],
);

export const celestialBodiesMappingSchema = createSelectSchema(
  celestialBodiesMapping,
);
export const createCelestialBodiesMappingSchema = createInsertSchema(
  celestialBodiesMapping,
);
export const updateCelestialBodiesMappingSchema = createUpdateSchema(
  celestialBodiesMapping,
);

export type CelestialBodyMapping = z.infer<typeof celestialBodiesMappingSchema>;
export type NewCelestialBodyMapping = z.infer<
  typeof createCelestialBodiesMappingSchema
>;
export type UpdateCelestialBodyMapping = z.infer<
  typeof updateCelestialBodiesMappingSchema
>;

export type CelestialBodyType = CelestialBodyMapping["type"];

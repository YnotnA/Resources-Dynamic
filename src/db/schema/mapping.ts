import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const celestialBodiesMapping = pgTable(
  "celestial_bodies_mapping",
  {
    uuid: uuid("uuid").primaryKey(),
    id: integer("id").notNull(),
    type: text("type", { enum: ["star", "planet", "moon"] }).notNull(),
    name: text("name").notNull(),
    systemId: integer("system_id").notNull(),
    parentId: integer("parent_id"), // planet_id pour les lunes
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    idTypeIdx: index("idx_celestial_mapping_id_type").on(table.id, table.type),
    systemIdx: index("idx_celestial_mapping_system").on(table.systemId),
  }),
);

export type CelestialBodyMapping = typeof celestialBodiesMapping.$inferSelect;
export type NewCelestialBodyMapping =
  typeof celestialBodiesMapping.$inferInsert;

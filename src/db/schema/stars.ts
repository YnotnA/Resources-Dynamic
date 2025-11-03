import { relations } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { systems } from "./systems";

export const stars = pgTable("stars", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().unique(),
  systemId: integer("system_id").references(() => systems.id),
  name: text("name").notNull(),
  massKg: doublePrecision("mass_kg").notNull(),
});

// Relations
export const starsRelations = relations(stars, ({ one }) => ({
  system: one(systems, {
    fields: [stars.systemId],
    references: [systems.id],
  }),
}));

export type Star = typeof stars.$inferSelect;
export type NewStar = typeof stars.$inferInsert;

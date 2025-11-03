import { relations } from "drizzle-orm";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

import { planets } from "./planets";
import { stars } from "./stars";

export const systems = pgTable("systems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

// Relations
export const systemsRelations = relations(systems, ({ many }) => ({
  stars: many(stars),
  planets: many(planets),
}));

export type System = typeof systems.$inferSelect;
export type NewSystem = typeof systems.$inferInsert;

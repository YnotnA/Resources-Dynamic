import { relations } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type { z } from "zod";

import { planets } from "./planets";
import { stars } from "./stars";

export const systems = pgTable("systems", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().unique(),
  internalName: text("internal_name").notNull().unique(),
});

// Relations
export const systemsRelations = relations(systems, ({ many }) => ({
  stars: many(stars),
  planets: many(planets),
}));

export const systemSchema = createSelectSchema(systems);
export const createSystemSchema = createInsertSchema(systems);
export const updateSystemSchema = createUpdateSchema(systems);

export type System = z.infer<typeof systemSchema>;
export type NewSystem = z.infer<typeof createSystemSchema>;
export type UpdateSystem = z.infer<typeof updateSystemSchema>;

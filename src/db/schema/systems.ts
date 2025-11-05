import { relations } from "drizzle-orm";
import { pgTable, serial, text, unique } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type { z } from "zod";

import { planets } from "./planets";
import { stars } from "./stars";

export const systems = pgTable(
  "systems",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    internalName: text("internal_name").notNull(),
  },
  (table) => [
    unique("unique_system_name").on(table.name),
    unique("unique_system_internal_name").on(table.internalName),
  ],
);

// Relations
export const systemsRelations = relations(systems, ({ many }) => ({
  stars: many(stars),
  planets: many(planets),
}));

export const systemSchema = createSelectSchema(systems);
export const createSystemSchema = createInsertSchema(systems).omit({
  id: true,
});
export const updateSystemSchema = createUpdateSchema(systems).omit({
  id: true,
});

export type System = z.infer<typeof systemSchema>;
export type NewSystem = z.infer<typeof createSystemSchema>;
export type UpdateSystem = z.infer<typeof updateSystemSchema>;

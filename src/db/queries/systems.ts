import { eq } from "drizzle-orm";

import { db } from "../connection";
import { type NewSystem, type System, systems } from "../schema";

/**
 * Récupère tous les systèmes
 */
export const getAllSystems = async (): Promise<System[]> => {
  return await db.select().from(systems);
};

/**
 * Récupère un système avec ses planètes et étoiles
 */
export const getSystemWithDetails = async (systemId: number) => {
  return await db.query.systems.findFirst({
    where: eq(systems.id, systemId),
    with: {
      planets: {
        with: {
          moons: true,
        },
      },
      stars: true,
    },
  });
};

/**
 * Crée un nouveau système
 */
export const createSystem = async (system: NewSystem): Promise<System> => {
  const result = await db.insert(systems).values(system).returning();
  return result[0];
};

/**
 * Récupère un système par son ID
 */
export const getSystemById = async (
  id: number,
): Promise<System | undefined> => {
  const result = await db.select().from(systems).where(eq(systems.id, id));
  return result[0];
};

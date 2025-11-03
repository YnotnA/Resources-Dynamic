import { eq } from "drizzle-orm";

import { db } from "../connection";
import { type NewPlanet, type Planet, planetMoons, planets } from "../schema";

/**
 * Récupère toutes les planètes
 */
export const getAllPlanets = async (): Promise<Planet[]> => {
  return await db.select().from(planets);
};

/**
 * Récupère une planète par UUID
 */
export const getPlanetByUuid = async (uuid: string) => {
  return await db.query.planets.findFirst({
    where: eq(planets.uuid, uuid),
    with: {
      system: true,
      moons: true,
    },
  });
};

/**
 * Récupère toutes les planètes d'un système
 */
export const getPlanetsBySystemId = async (systemId: number) => {
  return await db.query.planets.findMany({
    where: eq(planets.systemId, systemId),
    with: {
      moons: true,
    },
  });
};

/**
 * Crée une nouvelle planète
 */
export const createPlanet = async (planet: NewPlanet): Promise<Planet> => {
  const result = await db.insert(planets).values(planet).returning();
  return result[0];
};

/**
 * Met à jour une planète
 */
export const updatePlanet = async (
  uuid: string,
  data: Partial<NewPlanet>,
): Promise<Planet | undefined> => {
  const result = await db
    .update(planets)
    .set(data)
    .where(eq(planets.uuid, uuid))
    .returning();
  return result[0];
};

/**
 * Supprime une planète
 */
export const deletePlanet = async (uuid: string): Promise<boolean> => {
  const result = await db
    .delete(planets)
    .where(eq(planets.uuid, uuid))
    .returning();
  return result.length > 0;
};

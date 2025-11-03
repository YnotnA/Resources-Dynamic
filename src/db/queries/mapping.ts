import { createTimer, logPerformance, pgDbLogger } from "@app/lib/logger";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "../connection";
import { celestialBodiesMapping } from "../schema";
import { planetMoons, planets, stars } from "../schema";

/**
 * Synchronise la table de mapping avec les données actuelles
 * Filtre automatiquement les entrées sans UUID (ne devrait jamais arriver si DB bien configurée)
 */
export const syncMappingTable = async (): Promise<void> => {
  const timer = createTimer();
  pgDbLogger.info({ msg: "🔄 Starting mapping table sync..." });

  // Vider la table
  await db.delete(celestialBodiesMapping);

  // =====================================
  // Insérer les étoiles
  // =====================================
  const starsData = await db
    .select({
      uuid: stars.uuid,
      id: stars.id,
      name: stars.name,
      systemId: stars.systemId,
    })
    .from(stars)
    .where(and(isNotNull(stars.uuid), isNotNull(stars.systemId)));

  if (starsData.length > 0) {
    await db.insert(celestialBodiesMapping).values(
      starsData.map((s) => ({
        uuid: s.uuid!, // Non-null assertion safe après le WHERE
        id: s.id,
        type: "star" as const,
        name: s.name,
        systemId: s.systemId!,
        parentId: null,
      })),
    );
  }

  // =====================================
  // Insérer les planètes
  // =====================================
  const planetsData = await db
    .select({
      uuid: planets.uuid,
      id: planets.id,
      name: planets.name,
      systemId: planets.systemId,
    })
    .from(planets)
    .where(and(isNotNull(planets.uuid), isNotNull(planets.systemId)));

  if (planetsData.length > 0) {
    await db.insert(celestialBodiesMapping).values(
      planetsData.map((p) => ({
        uuid: p.uuid!,
        id: p.id,
        type: "planet" as const,
        name: p.name,
        systemId: p.systemId!,
        parentId: null,
      })),
    );
  }

  // =====================================
  // Insérer les lunes
  // =====================================
  const moonsData = await db
    .select({
      uuid: planetMoons.uuid,
      id: planetMoons.id,
      name: planetMoons.name,
      systemId: planets.systemId,
      planetId: planetMoons.planetId,
    })
    .from(planetMoons)
    .innerJoin(planets, eq(planetMoons.planetId, planets.id))
    .where(
      and(
        isNotNull(planetMoons.uuid),
        isNotNull(planets.systemId),
        isNotNull(planetMoons.planetId),
      ),
    );

  if (moonsData.length > 0) {
    await db.insert(celestialBodiesMapping).values(
      moonsData.map((m) => ({
        uuid: m.uuid!,
        id: m.id,
        type: "moon" as const,
        name: m.name,
        systemId: m.systemId!,
        parentId: m.planetId!,
      })),
    );
  }

  const duration = timer.end();
  const totalCount = starsData.length + planetsData.length + moonsData.length;
  pgDbLogger.debug({
    msg: "✅ Mapping table synced",
    duration,
    totalCount,
    stars: starsData.length,
    planets: planetsData.length,
    moons: moonsData.length,
  });

  logPerformance(pgDbLogger, "Sync mapping table", duration);
  // ⚠️ Warning entries without UUID
  const totalInDb = await countTotalCelestialBodies();
  if (totalCount < totalInDb) {
    pgDbLogger.warn({
      msg: `⚠️  Warning: ${totalInDb - totalCount} entries skipped (missing UUID or systemId)`,
    });
  }
};

/**
 * Compte le total d'objets célestes dans les tables sources
 */
const countTotalCelestialBodies = async (): Promise<number> => {
  const starsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(stars);
  const planetsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(planets);
  const moonsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(planetMoons);

  return (
    Number(starsCount[0].count) +
    Number(planetsCount[0].count) +
    Number(moonsCount[0].count)
  );
};

/**
 * Compte les entrées dans la table de mapping
 */
export const countMappings = async (): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(celestialBodiesMapping);

  return Number(result[0].count);
};

/**
 * Compte par type
 */
export const countMappingsByType = async () => {
  const result = await db
    .select({
      type: celestialBodiesMapping.type,
      count: sql<number>`count(*)`,
    })
    .from(celestialBodiesMapping)
    .groupBy(celestialBodiesMapping.type);

  return result.reduce(
    (acc, row) => {
      acc[row.type] = Number(row.count);
      return acc;
    },
    {} as Record<string, number>,
  );
};

/**
 * Vérifie l'intégrité : trouve les entrées sans UUID
 */
export const findEntriesWithoutUuid = async () => {
  const starsWithoutUuid = await db
    .select({ id: stars.id, name: stars.name })
    .from(stars)
    .where(sql`${stars.uuid} IS NULL`);

  const planetsWithoutUuid = await db
    .select({ id: planets.id, name: planets.name })
    .from(planets)
    .where(sql`${planets.uuid} IS NULL`);

  const moonsWithoutUuid = await db
    .select({ id: planetMoons.id, name: planetMoons.name })
    .from(planetMoons)
    .where(sql`${planetMoons.uuid} IS NULL`);

  return {
    stars: starsWithoutUuid,
    planets: planetsWithoutUuid,
    moons: moonsWithoutUuid,
    total:
      starsWithoutUuid.length +
      planetsWithoutUuid.length +
      moonsWithoutUuid.length,
  };
};

/**
 * Ajoute un mapping manuellement
 */
export const addMapping = async (data: {
  uuid: string;
  id: number;
  type: "star" | "planet" | "moon";
  name: string;
  systemId: number;
  parentId?: number | null;
}) => {
  return await db.insert(celestialBodiesMapping).values(data).returning();
};

/**
 * Met à jour un mapping
 */
export const updateMapping = async (
  uuid: string,
  data: Partial<{
    name: string;
    systemId: number;
    parentId: number | null;
  }>,
) => {
  return await db
    .update(celestialBodiesMapping)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(celestialBodiesMapping.uuid, uuid))
    .returning();
};

/**
 * Supprime un mapping
 */
export const removeMapping = async (uuid: string) => {
  return await db
    .delete(celestialBodiesMapping)
    .where(eq(celestialBodiesMapping.uuid, uuid))
    .returning();
};

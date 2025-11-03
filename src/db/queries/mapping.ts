import { createTimer, logPerformance, pgDbLogger } from "@/lib/logger";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "../connection";
import { celestialBodiesMapping } from "../schema";
import { planetMoons, planets, stars } from "../schema";

/**
 * Synchronizes the mapping table with the current data.
 * Automatically filters entries without UUIDs (should never happen if the database is configured correctly).
 */
export const syncMappingTable = async (): Promise<void> => {
  const timer = createTimer();
  pgDbLogger.info("🔄 Starting mapping table sync...");

  // clear table
  await db.delete(celestialBodiesMapping);

  // =====================================
  // Insert stars
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
        uuid: s.uuid!,
        id: s.id,
        type: "star" as const,
        name: s.name,
        systemId: s.systemId!,
        parentId: null,
      })),
    );
  }

  // =====================================
  // Insert planets
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
  // Insert moons
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
  pgDbLogger.debug(
    {
      duration,
      totalCount,
      stars: starsData.length,
      planets: planetsData.length,
      moons: moonsData.length,
    },
    "✅ Mapping table synced",
  );

  logPerformance(pgDbLogger, "Sync mapping table", duration);
  // ⚠️ Warning entries without UUID
  const totalInDb = await countTotalCelestialBodies();
  if (totalCount < totalInDb) {
    pgDbLogger.warn(
      `⚠️ Warning: ${totalInDb - totalCount} entries skipped (missing UUID or systemId)`,
    );
  }
};

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
